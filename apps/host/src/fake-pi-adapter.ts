import type { AnvilEvent, SessionSummary, UiMessage } from "@anvil/protocol";
import { decideGate, previewArgs, riskFor } from "@anvil/pi-ext-gate";
import type { ApprovalQueue } from "./approvals.ts";
import type { PiAdapter, PromptInput } from "./pi-adapter.ts";
import { upsertMessage, upsertTool, type WorkspaceState } from "./state.ts";
import { buildTree, demoTree, pathIdsFrom } from "./tree.ts";

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export class FakePiAdapter implements PiAdapter {
  readonly kind = "fake" as const;
  private listeners = new Set<(event: AnvilEvent) => void>();
  private runAbort: AbortController | null = null;
  private counter = 0;

  constructor(
    private readonly state: WorkspaceState,
    private readonly approvals?: ApprovalQueue,
  ) {}

  subscribe(cb: (event: AnvilEvent) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  async prompt(input: PromptInput): Promise<void> {
    this.runAbort?.abort();
    const run = new AbortController();
    this.runAbort = run;
    const signal = run.signal;
    const turn = ++this.counter;
    const now = Date.now();
    const userMessage: UiMessage = {
      id: `user-${turn}`,
      role: "user",
      text: input.text,
      createdAt: now,
    };
    const assistantId = `assistant-${turn}`;
    const callId = `tool-${turn}`;
    const chunks = ["收到。", "这是假 Agent 循环：先流式回复，再跑一张 bash 工具卡。"];

    upsertMessage(this.state, userMessage);
    this.state.tools = [];
    this.state.agentStatus = "running";
    this.state.usage = {
      inputTokens: this.state.usage.inputTokens + Math.max(8, input.text.length),
      outputTokens: this.state.usage.outputTokens,
      costUsd: this.state.usage.costUsd,
    };
    this.emit({ type: "agent/running" });
    this.emit({ type: "message/upsert", message: userMessage });
    this.emit({ type: "usage/update", tokens: this.state.usage });

    const assistant: UiMessage = {
      id: assistantId,
      role: "assistant",
      text: "",
      createdAt: now + 1,
      streaming: true,
    };
    upsertMessage(this.state, assistant);
    this.emit({ type: "message/upsert", message: { ...assistant } });

    try {
      for (const chunk of chunks) {
        await sleep(120, signal);
        assistant.text = assistant.text ? `${assistant.text} ${chunk}` : chunk;
        this.state.usage.outputTokens += chunk.length;
        this.emit({ type: "message/upsert", message: { ...assistant } });
        this.emit({ type: "usage/update", tokens: { ...this.state.usage } });
      }

      await sleep(80, signal);
      const args = { command: "git status" };
      const gate = decideGate({
        toolName: "bash",
        args,
        trust: this.state.trust,
        cwd: this.state.cwd,
      });
      upsertTool(this.state, {
        callId,
        name: "bash",
        args,
        status: "running",
        output: "",
      });
      this.emit({ type: "tool/start", callId, name: "bash", args });

      if (gate.decision === "deny") {
        const output = `已拒绝：${gate.reason}`;
        upsertTool(this.state, { callId, name: "bash", args, status: "error", output });
        this.emit({ type: "tool/end", callId, ok: false, result: output });
        assistant.text += ` 工具被闸门拦截（${gate.reason}）。`;
      } else if (gate.decision === "ask" && this.approvals) {
        const request = {
          requestId: `appr-${turn}`,
          toolName: "bash",
          argsPreview: previewArgs(args),
          risk: riskFor("bash", args),
        };
        this.state.pendingApproval = request;
        const waited = this.approvals.wait(request);
        this.emit({ type: "approval/needed", request });
        const decision = await waited;
        this.state.pendingApproval = null;
        if (decision !== "allow-once") {
          const output = "用户拒绝了这次 bash 调用。";
          upsertTool(this.state, { callId, name: "bash", args, status: "error", output });
          this.emit({ type: "tool/end", callId, ok: false, result: output });
          assistant.text += " 用户拒绝了 git status。";
        } else {
          const output = this.state.cwd
            ? `On branch main\nnothing to commit, working tree clean\n(cwd=${this.state.cwd})`
            : "On branch main\nnothing to commit, working tree clean";
          upsertTool(this.state, { callId, name: "bash", args, status: "success", output });
          this.emit({ type: "tool/update", callId, partial: output });
          this.emit({ type: "tool/end", callId, ok: true, result: output });
          this.noteDemoChange();
          assistant.text += " 假循环结束，可以继续发消息。";
        }
      } else {
        const output = "On branch main\nnothing to commit, working tree clean";
        upsertTool(this.state, { callId, name: "bash", args, status: "success", output });
        this.emit({ type: "tool/update", callId, partial: output });
        this.emit({ type: "tool/end", callId, ok: true, result: output });
        this.noteDemoChange();
        assistant.text += " 假循环结束，可以继续发消息。";
      }

      await sleep(70, signal);
      assistant.streaming = false;
      this.emit({ type: "message/upsert", message: { ...assistant } });
      if (this.runAbort === run) {
        this.refreshTree(assistant.id);
        this.finishIdle();
      }
    } catch (error) {
      if (this.runAbort !== run) {
        return;
      }
      if (signal.aborted) {
        assistant.text = assistant.text || "已中止假循环。";
        assistant.streaming = false;
        this.emit({ type: "message/upsert", message: { ...assistant } });
        this.finishIdle();
        return;
      }
      this.state.agentStatus = "error";
      const message = error instanceof Error ? error.message : String(error);
      this.emit({ type: "agent/error", error: message });
    }
  }

  async steer(text: string): Promise<void> {
    const message: UiMessage = {
      id: `steer-${Date.now()}`,
      role: "system",
      text: `已排队插入方向：${text}`,
      createdAt: Date.now(),
    };
    upsertMessage(this.state, message);
    this.emit({ type: "message/upsert", message });
  }

  async followUp(text: string): Promise<void> {
    const message: UiMessage = {
      id: `follow-${Date.now()}`,
      role: "system",
      text: `已排队结束后再做：${text}`,
      createdAt: Date.now(),
    };
    upsertMessage(this.state, message);
    this.emit({ type: "message/upsert", message });
  }

  async abort(): Promise<void> {
    this.runAbort?.abort();
    this.approvals?.rejectAll();
    this.state.pendingApproval = null;
    this.finishIdle();
  }

  async fork(entryId: string): Promise<SessionSummary> {
    const found = this.state.messages.find((item) => item.id === entryId);
    if (!found) {
      throw new Error("找不到要分叉的节点");
    }
    const id = `sess-fork-${Date.now()}`;
    const title = `分叉自 ${found.text.slice(0, 16)}`;
    const session: SessionSummary = { id, title, mtime: Date.now(), tokens: 0 };
    this.state.sessions.unshift(session);
    this.state.sessionId = id;
    this.state.sessionTitle = title;
    const keep = new Set(pathIdsFrom(this.state.treeSeeds, entryId));
    this.state.messages = this.state.messages.filter((item) => keep.has(item.id) || item.role === "system");
    this.state.tools = [];
    this.refreshTree(entryId);
    this.emit({ type: "session/replaced", sessionId: id, title });
    return session;
  }

  async navigate(entryId: string): Promise<void> {
    if (this.state.agentStatus === "running") {
      throw new Error("等当前轮结束再切换分支");
    }
    const keep = pathIdsFrom(this.state.treeSeeds, entryId);
    if (keep.size === 0 && this.state.messages.every((item) => item.id !== entryId)) {
      throw new Error("节点不存在");
    }
    this.state.currentEntryId = entryId;
    this.refreshTree(entryId);
  }

  async compact(): Promise<void> {
    const leaf = this.state.currentEntryId ?? this.state.messages.at(-1)?.id ?? null;
    if (!leaf) {
      return;
    }
    const seed = this.state.treeSeeds.find((item) => item.id === leaf);
    if (seed) {
      seed.status = "compressed";
      seed.summary = `压缩：${seed.summary}`;
    }
    this.refreshTree(leaf);
  }

  async dispose(): Promise<void> {
    this.runAbort?.abort();
    this.listeners.clear();
  }

  private noteDemoChange(): void {
    const path = ".anvil/demo-diff.txt";
    const before = "demo before\n";
    const after = "demo after\n";
    this.state.snapshots[path] = { before, after };
    this.state.changes = [
      {
        path,
        kind: "modified",
        diff: `--- a/${path}\n+++ b/${path}\n-demo before\n+demo after`,
      },
    ];
    this.emit({ type: "fs/changed", paths: [path], changes: this.state.changes });
  }

  private refreshTree(currentId: string | null): void {
    const { tree, seeds } = demoTree(this.state.messages, currentId);
    this.state.tree = tree ?? buildTree(this.state.treeSeeds, currentId);
    this.state.treeSeeds = seeds.length ? seeds : this.state.treeSeeds;
    this.state.currentEntryId = currentId;
    if (this.state.tree) {
      this.emit({ type: "tree/changed", root: this.state.tree });
    }
  }

  private finishIdle(): void {
    this.state.agentStatus = "idle";
    this.emit({ type: "agent/idle" });
  }

  private emit(event: AnvilEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
