import {
  canDelegate,
  FileLockTable,
  PERSONAS,
  personaAllowsWrite,
  shouldQueue,
  type PersonaId,
} from "@anvil/pi-ext-delegate";
import type { AnvilEvent, TaskSummary } from "@anvil/protocol";
import { ApprovalQueue } from "./approvals.ts";
import { FakePiAdapter } from "./fake-pi-adapter.ts";
import { persistPiSession } from "./session-persist.ts";
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
  ) {
    this.children = new Map();
  }

  private children: Map<string, FakePiAdapter>;

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
      const spec = PERSONAS[persona] ?? PERSONAS.implementer;
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
      const persona = PERSONAS[task.persona as PersonaId] ?? PERSONAS.implementer;
      const latest = this.state.tasks.find((item) => item.id === task.id);
      if (!latest || latest.status === "cancelled") {
        return;
      }
      if (personaAllowsWrite(task.persona)) {
        const target = task.cwd ? `${task.cwd.replace(/\\/g, "/")}/notes.md` : WRITE_TARGET;
        const lock = this.locks.tryLock(task.id, target);
        if (!lock.ok) {
          this.finish(task, "failed", { error: `文件被任务 ${lock.owner} 锁定` });
          return;
        }
      }
      const childCwd = task.cwd && this.state.cwd ? resolveInside(this.state.cwd, task.cwd) : this.state.cwd;
      const childState = createWorkspaceState("fake");
      childState.cwd = childCwd;
      childState.trust = personaAllowsWrite(task.persona) ? this.state.trust : "untrusted";
      childState.settings = { ...this.state.settings };
      childState.sessionId = task.sessionId;
      childState.sessionTitle = `${persona.label} · ${task.goal.slice(0, 24)}`;
      const child = new FakePiAdapter(childState, new ApprovalQueue(), {
        tools: personaAllowsWrite(task.persona) ? "bash" : "none",
      });
      this.children.set(task.id, child);
      child.subscribe((event) => {
        if (event.type === "approval/needed") {
          task.status = "waiting_approval";
          this.emitTask(task);
          this.emit({
            type: "approval/needed",
            request: { ...event.request, taskId: task.id },
          });
        }
      });
      await child.prompt({
        text: `${persona.system}\n\n目标：${task.goal}\n范围：${task.cwd ?? "."}\n禁止再委派。`,
      });
      const still = this.state.tasks.find((item) => item.id === task.id);
      if (!still || still.status === "cancelled") {
        return;
      }
      const summary =
        childState.messages.find((item) => item.role === "assistant")?.text ??
        `${persona.label}完成：${task.goal.slice(0, 80)}`;
      this.finish(task, "succeeded", { summary });
    } catch (error) {
      this.finish(task, "failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      const child = this.children.get(task.id);
      this.children.delete(task.id);
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

  private emit(event: AnvilEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}


