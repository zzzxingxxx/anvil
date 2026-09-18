import { SessionManager } from "@earendil-works/pi-coding-agent";
import { ArtifactStore, unifiedDiff } from "@anvil/pi-ext-artifact";
import type { AnvilEvent, ModelInfo, SessionSummary, UiMessage } from "@anvil/protocol";
import { decideGate, previewArgs, riskFor } from "@anvil/pi-ext-gate";
import type { ApprovalQueue } from "./approvals.ts";
import type { PiAdapter, PromptInput } from "./pi-adapter.ts";
import { gitDiff } from "./artifacts.ts";
import { latestSession, toSessionSummary } from "./sdk-map.ts";
import { appendPiAssistant, appendPiUser, hydrateUiFromPi, persistPiSession } from "./session-persist.ts";
import { recordUsage } from "./usage-ledger.ts";
import { resetConversation, upsertMessage, upsertTool, type WorkspaceState } from "./state.ts";
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
  private queuedSteer: string[] = [];
  private queuedFollowUp: string[] = [];

  constructor(
    private readonly state: WorkspaceState,
    private readonly approvals?: ApprovalQueue,
    private readonly options: { tools?: "bash" | "none"; taskId?: string } = {},
  ) {}

  subscribe(cb: (event: AnvilEvent) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  async openWorkspace(_cwd: string): Promise<void> {
    await this.refreshSessions();
    const latest = latestSession(this.state.sessions);
    if (!latest) {
      return;
    }
    try {
      await this.resumeSession(latest.id);
    } catch {
      /* listing is still useful even if hydrate fails */
    }
  }

  async listSessions(): Promise<SessionSummary[]> {
    await this.refreshSessions();
    return this.state.sessions;
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
    const created = this.ensureSessionFile(input.text);
    if (!created && this.state.sessionId?.endsWith(".jsonl")) {
      try {
        appendPiUser(this.state.sessionId, input.text);
      } catch {
        /* keep the fake loop even if jsonl append fails */
      }
    }
    this.state.tools = [];
    this.state.agentStatus = "running";
    this.state.usage = {
      inputTokens: this.state.usage.inputTokens + Math.max(8, input.text.length),
      outputTokens: this.state.usage.outputTokens,
      costUsd: (this.state.usage.costUsd ?? 0) + 0.0002,
    };
    this.emit({ type: "agent/running" });
    this.emit({ type: "message/upsert", message: userMessage });
    this.emit({ type: "usage/update", tokens: this.state.usage });
    void recordUsage({
      inputTokens: Math.max(8, input.text.length),
      outputTokens: 0,
      costUsd: 0.0002,
    });

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
      if (this.options.tools === "none") {
        assistant.text += " 只读子任务结束，没有调用 bash。";
        await sleep(70, signal);
        assistant.streaming = false;
        this.emit({ type: "message/upsert", message: { ...assistant } });
        if (this.state.sessionId?.endsWith(".jsonl") && assistant.text) {
          try {
            appendPiAssistant(this.state.sessionId, assistant.text);
          } catch {
            /* ignore persist errors in the demo loop */
          }
        }
        if (this.runAbort === run) {
          this.refreshTree(assistant.id);
          this.finishIdle();
        }
        return;
      }
      const args = { command: "git status" };
      const gate = decideGate({
        toolName: "bash",
        args,
        trust: this.state.trust,
        cwd: this.state.cwd,
        bashPolicy: this.state.settings.bashPolicy,
        bashAllowlist: this.state.settings.bashAllowlist,
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
          taskId: this.options.taskId,
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
          await this.noteDemoChange();
          assistant.text += " 假循环结束，可以继续发消息。";
        }
      } else {
        const output = "On branch main\nnothing to commit, working tree clean";
        upsertTool(this.state, { callId, name: "bash", args, status: "success", output });
        this.emit({ type: "tool/update", callId, partial: output });
        this.emit({ type: "tool/end", callId, ok: true, result: output });
        await this.noteDemoChange();
        assistant.text += " 假循环结束，可以继续发消息。";
      }

      await sleep(70, signal);
      assistant.streaming = false;
      this.emit({ type: "message/upsert", message: { ...assistant } });
      if (this.state.sessionId?.endsWith(".jsonl") && assistant.text) {
        try {
          appendPiAssistant(this.state.sessionId, assistant.text);
        } catch {
          /* ignore persist errors in the demo loop */
        }
      }
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
    this.queuedSteer.push(text);
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
    this.queuedFollowUp.push(text);
    const message: UiMessage = {
      id: `follow-${Date.now()}`,
      role: "system",
      text: `已排队结束后再做：${text}`,
      createdAt: Date.now(),
    };
    upsertMessage(this.state, message);
    this.emit({ type: "message/upsert", message });
  }

  async abort(): Promise<string | void> {
    this.runAbort?.abort();
    this.approvals?.rejectAll();
    this.state.pendingApproval = null;
    const restoredDraft = this.takeQueuedDraft();
    this.finishIdle(restoredDraft);
    return restoredDraft;
  }

  async newSession(title?: string): Promise<SessionSummary> {
    if (this.state.agentStatus === "running") {
      throw new Error("等当前轮结束再新建会话");
    }
    const label = title ?? `假循环 ${this.state.sessions.length + 1}`;
    let id = `sess-fake-${Date.now()}`;
    if (this.state.cwd) {
      id = persistPiSession({
        cwd: this.state.cwd,
        title: label,
        userText: "Anvil 假循环新建的会话。官方 pi --session 应能打开。",
        assistantText: "假循环已落盘。没有模型密钥时也能被 SessionManager 读取。",
      });
    }
    const session: SessionSummary = { id, title: label, mtime: Date.now(), tokens: 0 };
    this.state.sessions.unshift(session);
    this.state.sessionId = session.id;
    this.state.sessionTitle = session.title;
    resetConversation(this.state);
    this.emit({ type: "session/replaced", sessionId: session.id, title: session.title });
    return session;
  }

  async listModels(): Promise<ModelInfo[]> {
    return this.state.models;
  }

  async setModel(id: string): Promise<ModelInfo> {
    const found = this.state.models.find((item) => item.id === id);
    const model = found ?? { id, label: id, provider: id.includes("/") ? id.split("/")[0]! : "fake" };
    if (!found) {
      this.state.models.push(model);
    }
    this.state.model = model;
    this.state.settings = { ...this.state.settings, defaultModel: id };
    return model;
  }

  async resumeSession(id: string): Promise<SessionSummary> {
    if (this.state.agentStatus === "running") {
      throw new Error("等当前轮结束再切换会话");
    }
    const found = this.state.sessions.find((item) => item.id === id);
    if (id.endsWith(".jsonl")) {
      const hydrated = hydrateUiFromPi(id);
      const session: SessionSummary = {
        id,
        title: hydrated.title,
        mtime: Date.now(),
        tokens: hydrated.messages.length,
      };
      this.state.sessionId = id;
      this.state.sessionTitle = hydrated.title;
      if (!found) {
        this.state.sessions.unshift(session);
      }
      resetConversation(this.state);
      this.state.messages = hydrated.messages;
      this.refreshTree(hydrated.messages.at(-1)?.id ?? null);
      this.emit({ type: "session/replaced", sessionId: id, title: hydrated.title });
      return session;
    }
    if (!found) {
      throw new Error("会话不存在");
    }
    this.state.sessionId = found.id;
    this.state.sessionTitle = found.title;
    resetConversation(this.state);
    this.emit({ type: "session/replaced", sessionId: found.id, title: found.title });
    return found;
  }

  async fork(entryId: string): Promise<SessionSummary> {
    if (this.state.agentStatus === "running") {
      throw new Error("等当前轮结束再分叉");
    }
    const found = this.state.messages.find((item) => item.id === entryId);
    if (!found) {
      throw new Error("找不到要分叉的节点");
    }
    const title = `分叉自 ${found.text.slice(0, 16)}`;
    const keep = new Set(pathIdsFrom(this.state.treeSeeds, entryId));
    this.state.messages = this.state.messages.filter((item) => keep.has(item.id) || item.role === "system");
    this.state.tools = [];
    let id = `sess-fork-${Date.now()}`;
    if (this.state.cwd) {
      const userText = this.state.messages.find((item) => item.role === "user")?.text ?? found.text;
      const assistantText =
        this.state.messages.find((item) => item.role === "assistant")?.text ?? "分叉后的假循环会话。";
      id = persistPiSession({
        cwd: this.state.cwd,
        parentSession: this.state.sessionId?.endsWith(".jsonl") ? this.state.sessionId : undefined,
        title,
        userText,
        assistantText,
      });
    }
    const session: SessionSummary = { id, title, mtime: Date.now(), tokens: 0 };
    this.state.sessions.unshift(session);
    this.state.sessionId = id;
    this.state.sessionTitle = title;
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

  async compact(instructions?: string): Promise<void> {
    if (this.state.agentStatus === "running") {
      throw new Error("等当前轮结束再压缩");
    }
    const leaf = this.state.currentEntryId ?? this.state.messages.at(-1)?.id ?? null;
    if (!leaf) {
      return;
    }
    const seed = this.state.treeSeeds.find((item) => item.id === leaf);
    const summary = `压缩：${(instructions ?? seed?.summary ?? "当前分支").slice(0, 80)}`;
    if (seed) {
      seed.status = "compressed";
      seed.summary = summary;
    }
    const message: UiMessage = {
      id: `compact-${Date.now()}`,
      role: "system",
      text: summary,
      createdAt: Date.now(),
    };
    upsertMessage(this.state, message);
    this.emit({ type: "message/upsert", message });
    if (this.state.sessionId?.endsWith(".jsonl")) {
      try {
        appendPiAssistant(this.state.sessionId, summary);
      } catch {
        /* keep compact even if jsonl append fails */
      }
    }
    this.refreshTree(leaf);
  }

  async dispose(): Promise<void> {
    this.runAbort?.abort();
    this.listeners.clear();
  }

  private async noteDemoChange(): Promise<void> {
    const path = ".anvil/demo-diff.txt";
    const before = "demo before\n";
    const after = "demo after\n";
    this.state.snapshots[path] = { before, after };
    const git = this.state.cwd ? await gitDiff(this.state.cwd, path) : null;
    this.state.changes = [
      {
        path,
        kind: "modified",
        diff: git ?? unifiedDiff(path, before, after),
      },
    ];
    if (this.state.cwd) {
      try {
        await new ArtifactStore(this.state.cwd).snapshotWrite(path, after);
      } catch {
        /* demo snapshots must not crash the fake loop */
      }
    }
    this.emit({ type: "fs/changed", paths: [path], changes: this.state.changes });
  }

  private refreshTree(currentId: string | null): void {
    const compressed = new Map(
      this.state.treeSeeds.filter((item) => item.status === "compressed").map((item) => [item.id, item]),
    );
    const { tree, seeds } = demoTree(this.state.messages, currentId);
    const merged = seeds.map((seed) => {
      const previous = compressed.get(seed.id);
      return previous ? { ...seed, status: previous.status, summary: previous.summary } : seed;
    });
    this.state.treeSeeds = merged.length ? merged : this.state.treeSeeds;
    this.state.tree = buildTree(this.state.treeSeeds, currentId) ?? tree;
    this.state.currentEntryId = currentId;
    if (this.state.tree) {
      this.emit({ type: "tree/changed", root: this.state.tree });
    }
  }

  private async refreshSessions(): Promise<void> {
    const cwd = this.state.cwd;
    if (!cwd) {
      this.state.sessions = [];
      return;
    }
    try {
      const listed = await SessionManager.list(cwd);
      this.state.sessions = listed.map(toSessionSummary).sort((a, b) => b.mtime - a.mtime);
    } catch {
      this.state.sessions = [];
    }
  }

  private ensureSessionFile(firstUserText: string): boolean {
    if (!this.state.cwd || this.state.sessionId?.endsWith(".jsonl")) {
      return false;
    }
    const title = this.state.sessionTitle ?? "假循环";
    const id = persistPiSession({
      cwd: this.state.cwd,
      title,
      userText: firstUserText,
      assistantText: "假循环会话已落盘。",
    });
    this.state.sessionId = id;
    const existing = this.state.sessions.find((item) => item.title === title);
    if (existing) {
      existing.id = id;
    } else {
      this.state.sessions.unshift({ id, title, mtime: Date.now(), tokens: 0 });
    }
    return true;
  }

  private takeQueuedDraft(): string | undefined {
    const text = [...this.queuedSteer, ...this.queuedFollowUp].join("\n").trim();
    this.queuedSteer = [];
    this.queuedFollowUp = [];
    return text || undefined;
  }

  private finishIdle(restoredDraft?: string): void {
    this.state.agentStatus = "idle";
    this.emit(restoredDraft ? { type: "agent/idle", restoredDraft } : { type: "agent/idle" });
  }

  private emit(event: AnvilEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
