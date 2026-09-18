import {
  canDelegate,
  FileLockTable,
  PERSONAS,
  personaAllowsWrite,
  shouldQueue,
  type PersonaId,
} from "@anvil/pi-ext-delegate";
import type { PersonaSpec } from "./personas.ts";
import type { AnvilEvent, TaskSummary } from "@anvil/protocol";
import { ApprovalQueue } from "./approvals.ts";
import { FakePiAdapter } from "./fake-pi-adapter.ts";
import type { AdapterKind, PiAdapter } from "./pi-adapter.ts";
import { persistPiSession } from "./session-persist.ts";
import { SdkPiAdapter } from "./sdk-pi-adapter.ts";
import { createWorkspaceState, type WorkspaceState } from "./state.ts";
import { resolveInside } from "./workspace.ts";

export type DelegateInput = {
  goal: string;
  persona?: string;
  cwd?: string;
  timeoutSec?: number;
  maxUsd?: number;
  parentIsChild?: boolean;
};

const WRITE_TARGET = "docs/dogfood/phase3.md";

export class TaskOrchestrator {
  readonly locks = new FileLockTable();
  private listeners = new Set<(event: AnvilEvent) => void>();
  private pumping = false;
  private pumpAgain = false;

  constructor(
    private readonly state: WorkspaceState,
    private readonly sessionDir?: string,
    private readonly approvals?: ApprovalQueue,
    private readonly personas: Record<PersonaId, PersonaSpec> = PERSONAS,
  ) {
    this.children = new Map();
  }

  private children: Map<string, PiAdapter>;
  private limits = new Map<string, { timeoutSec?: number; maxUsd?: number }>();

  subscribe(cb: (event: AnvilEvent) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  list(): TaskSummary[] {
    return this.state.tasks;
  }

  async delegate(input: DelegateInput): Promise<TaskSummary> {
    if (!this.state.cwd) {
      throw new Error("请先打开工作区");
    }
    const persona = (input.persona ?? "implementer") as PersonaId;
    const allowed = canDelegate({
      goal: input.goal,
      persona,
      cwd: input.cwd,
      trust: this.state.trust,
      parentIsChild: Boolean(input.parentIsChild),
      runningCount: this.runningCount(),
      workspaceRoot: this.state.cwd,
    });
    if (!allowed.ok) {
      throw new Error(allowed.reason);
    }
    const task: TaskSummary = {
      id: `task-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      parentSessionId: this.state.sessionId,
      sessionId: this.persistChildSession(persona, input.goal, input.cwd),
      persona,
      goal: input.goal,
      status: shouldQueue(this.runningCount()) ? "queued" : "running",
      column: shouldQueue(this.runningCount()) ? "todo" : "doing",
      cwd: input.cwd,
      startedAt: Date.now(),
    };
    if (input.timeoutSec != null || input.maxUsd != null) {
      this.limits.set(task.id, { timeoutSec: input.timeoutSec, maxUsd: input.maxUsd });
    }
    this.state.tasks = [task, ...this.state.tasks];
    this.emitTask(task);
    void this.pump();
    return task;
  }

  move(id: string, column: NonNullable<TaskSummary["column"]>): TaskSummary {
    const task = this.state.tasks.find((item) => item.id === id);
    if (!task) {
      throw new Error("任务不存在");
    }
    task.column = column;
    this.emitTask(task);
    return task;
  }

  cancel(id: string): TaskSummary {
    const task = this.state.tasks.find((item) => item.id === id);
    if (!task) {
      throw new Error("任务不存在");
    }
    if (task.status === "succeeded" || task.status === "failed" || task.status === "cancelled") {
      return task;
    }
    const child = this.children.get(id);
    void child?.abort();
    this.finish(task, "cancelled", { error: "用户取消" });
    void this.pump();
    return task;
  }

  private persistChildSession(persona: PersonaId, goal: string, relativeCwd?: string): string {
    const fallback = `child:${this.state.sessionId ?? "none"}:${Date.now()}`;
    if (!this.state.cwd) {
      return fallback;
    }
    try {
      const childCwd = relativeCwd ? resolveInside(this.state.cwd, relativeCwd) : this.state.cwd;
      const spec = this.personas[persona] ?? this.personas.implementer ?? PERSONAS.implementer;
      const file = persistPiSession({
        cwd: childCwd,
        sessionDir: this.sessionDir,
        parentSession: this.state.sessionId ?? undefined,
        title: `${spec.label}: ${goal.slice(0, 40)}`,
        userText: `${spec.system}\n\n目标：${goal}\n禁止再委派。`,
        assistantText: "子任务已创建。官方 pi 可用 --session 打开本文件。",
      });
      this.state.sessions.unshift({
        id: file,
        title: `${spec.label} · ${goal.slice(0, 24)}`,
        mtime: Date.now(),
      });
      return file;
    } catch {
      return fallback;
    }
  }

  private runningCount(): number {
    return this.state.tasks.filter((item) => item.status === "running" || item.status === "waiting_approval")
      .length;
  }

  private async pump(): Promise<void> {
    if (this.pumping) {
      this.pumpAgain = true;
      return;
    }
    this.pumping = true;
    try {
      do {
        this.pumpAgain = false;
        const starters: Promise<void>[] = [];
        for (const item of this.state.tasks) {
          if (item.status === "running" && !this.inFlight.has(item.id)) {
            starters.push(this.run(item));
          }
        }
        while (this.runningCount() < 2) {
          const next = this.state.tasks.find((item) => item.status === "queued");
          if (!next) {
            break;
          }
          next.status = "running";
          next.column = "doing";
          this.emitTask(next);
          starters.push(this.run(next));
        }
        if (starters.length === 0) {
          continue;
        }
        await Promise.all(starters);
      } while (this.pumpAgain);
    } finally {
      this.pumping = false;
    }
  }

  private inFlight = new Set<string>();

  private async run(task: TaskSummary): Promise<void> {
    if (this.inFlight.has(task.id) || task.status !== "running") {
      return;
    }
    this.inFlight.add(task.id);
    try {
      const persona =
        this.personas[task.persona as PersonaId] ?? this.personas.implementer ?? PERSONAS.implementer;
      const latest = this.state.tasks.find((item) => item.id === task.id);
      if (!latest || latest.status === "cancelled") {
        return;
      }
      if (personaAllowsWrite(task.persona)) {
        const target = task.cwd ? `${task.cwd.replace(/\\/g, "/")}/notes.md` : WRITE_TARGET;
        const lock = this.locks.tryLock(task.id, target);
        if (!lock.ok) {
          this.finish(task, "failed", { error: classifyFailure(`文件被任务 ${lock.owner} 锁定`) });
          return;
        }
      }
      const childCwd = task.cwd && this.state.cwd ? resolveInside(this.state.cwd, task.cwd) : this.state.cwd;
      const childKind = childAdapterKind(this.state.adapterKind);
      const childState = createWorkspaceState(childKind);
      childState.cwd = childCwd;
      childState.trust = personaAllowsWrite(task.persona) ? this.state.trust : "untrusted";
      childState.settings = { ...this.state.settings };
      childState.sessionId = task.sessionId;
      childState.sessionTitle = `${persona.label} · ${task.goal.slice(0, 24)}`;
      const approvals = this.approvals ?? new ApprovalQueue();
      const child =
        childKind === "sdk"
          ? new SdkPiAdapter(childState, approvals, { taskId: task.id })
          : new FakePiAdapter(childState, approvals, {
              tools: personaAllowsWrite(task.persona) ? "bash" : "none",
              taskId: task.id,
            });
      this.children.set(task.id, child);
      child.subscribe((event) => {
        if (event.type === "approval/needed") {
          task.status = "waiting_approval";
          this.state.pendingApproval = { ...event.request, taskId: task.id };
          this.emitTask(task);
          this.emit({
            type: "approval/needed",
            request: { ...event.request, taskId: task.id },
          });
        }
      });
      const limits = this.limits.get(task.id) ?? {};
      const timeoutMs = (limits.timeoutSec ?? 0) * 1000;
      let timedOut = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          timedOut = true;
          void child.abort();
        }, timeoutMs);
      }
      try {
        if (childKind === "sdk" && task.sessionId?.endsWith(".jsonl")) {
          await child.resumeSession?.(task.sessionId);
        }
        await child.prompt({
          text: `${persona.system}\n\n目标：${task.goal}\n范围：${task.cwd ?? "."}\n禁止再委派。`,
        });
      } finally {
        if (timer) {
          clearTimeout(timer);
        }
      }
      const still = this.state.tasks.find((item) => item.id === task.id);
      if (!still || still.status === "cancelled") {
        return;
      }
      if (still.status === "waiting_approval") {
        still.status = "running";
        still.column = "doing";
        this.emitTask(still);
      }
      this.rollUpUsage(childState.usage);
      if (timedOut) {
        this.finish(task, "failed", { error: classifyFailure("超时：子任务超过时限") });
        return;
      }
      if (limits.maxUsd != null && (childState.usage.costUsd ?? 0) > limits.maxUsd) {
        this.finish(task, "failed", {
          error: classifyFailure(`超费：$${childState.usage.costUsd?.toFixed(4)} 超过 $${limits.maxUsd}`),
          costUsd: childState.usage.costUsd,
        });
        return;
      }
      const denied = childState.tools.find((item) => item.status === "error");
      if (denied) {
        this.finish(task, "failed", { error: classifyFailure(denied.output ?? "用户拒绝"), costUsd: childState.usage.costUsd });
        return;
      }
      const summary =
        childState.messages.find((item) => item.role === "assistant")?.text ??
        `${persona.label}完成：${task.goal.slice(0, 80)}`;
      this.finish(task, "succeeded", { summary, costUsd: childState.usage.costUsd });
    } catch (error) {
      this.finish(task, "failed", {
        error: classifyFailure(error instanceof Error ? error.message : String(error)),
      });
    } finally {
      const child = this.children.get(task.id);
      this.children.delete(task.id);
      this.limits.delete(task.id);
      void child?.dispose();
      this.inFlight.delete(task.id);
      this.locks.release(task.id);
    }
  }

  private finish(
    task: TaskSummary,
    status: TaskSummary["status"],
    extra: Partial<TaskSummary> = {},
  ): void {
    task.status = status;
    task.endedAt = Date.now();
    if (status === "succeeded") task.column = "done";
    if (status === "failed" || status === "cancelled") task.column = "blocked";
    Object.assign(task, extra);
    if (this.state.pendingApproval?.taskId === task.id) {
      this.state.pendingApproval = null;
    }
    this.emitTask(task);
    if (status === "succeeded" && extra.summary) {
      const message = {
        id: `task-summary-${task.id}`,
        role: "system" as const,
        text: `子任务 ${task.persona} 摘要：\n${extra.summary}`,
        createdAt: Date.now(),
      };
      this.state.messages.push(message);
      this.emit({ type: "message/upsert", message });
    }
  }

  private emitTask(task: TaskSummary): void {
    this.emit({ type: "task/upsert", task: { ...task } });
  }

  private rollUpUsage(childUsage: WorkspaceState["usage"]): void {
    this.state.usage = {
      inputTokens: this.state.usage.inputTokens + childUsage.inputTokens,
      outputTokens: this.state.usage.outputTokens + childUsage.outputTokens,
      costUsd: (this.state.usage.costUsd ?? 0) + (childUsage.costUsd ?? 0),
    };
    this.emit({ type: "usage/update", tokens: { ...this.state.usage } });
  }

  private emit(event: AnvilEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

export function childAdapterKind(parentKind: AdapterKind): "fake" | "sdk" {
  return parentKind === "sdk" ? "sdk" : "fake";
}

function classifyFailure(message: string): string {
  if (message.startsWith("锁冲突") || message.startsWith("超时") || message.startsWith("超费") || message.startsWith("用户拒绝") || message.startsWith("模型错误")) {
    return message;
  }
  if (message.includes("锁定")) return `锁冲突：${message}`;
  if (message.includes("超时")) return `超时：${message}`;
  if (message.includes("超费") || message.toLowerCase().includes("usd")) return `超费：${message}`;
  if (message.includes("拒绝") || message.includes("取消")) return `用户拒绝：${message}`;
  return `模型错误：${message}`;
}


