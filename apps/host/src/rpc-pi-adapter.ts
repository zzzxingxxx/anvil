import { RpcClient, SessionManager } from "@earendil-works/pi-coding-agent";
import type { AnvilEvent, ModelInfo, SessionSummary, UiMessage } from "@anvil/protocol";
import type { PiAdapter, PromptInput } from "./pi-adapter.ts";
import { resetConversation, upsertMessage, type WorkspaceState } from "./state.ts";
import { applyPiSessionEvent } from "./sdk-events.ts";
import { latestSession, toModelInfo, toSessionSummary, toUiMessage, usageFromSessionStats } from "./sdk-map.ts";
import { deleteSessionFile, renameSessionFile } from "./session-ops.ts";
import { expandSkillPrompt } from "./skills.ts";
import { buildTree, pathIdsFrom, seedsFromRpcTree } from "./tree.ts";

/**
 * Sidecar adapter: official Pi RPC client.
 * Untrusted workspaces can opt in with ANVIL_PI_MODE=rpc.
 */
export class RpcPiAdapter implements PiAdapter {
  readonly kind = "rpc" as const;
  private listeners = new Set<(event: AnvilEvent) => void>();
  private client: RpcClient | null = null;
  private restarts = 0;
  private crashRestarts = 0;
  private lastCwd: string | null = null;

  restartsUsed(): number {
    return this.crashRestarts;
  }

  constructor(private readonly state: WorkspaceState) {}

  subscribe(cb: (event: AnvilEvent) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  async openWorkspace(cwd: string): Promise<void> {
    await this.restart(cwd);
    await this.refreshSessions();
    try {
      await this.listModels();
    } catch {
      /* sidecar may start without models configured */
    }
    const latest = latestSession(this.state.sessions);
    if (latest) {
      await this.resumeSession(latest.id);
      return;
    }
    await this.hydrateFromRpc();
  }

  async prompt(input: PromptInput): Promise<void> {
    const client = await this.requireClient();
    let text = input.text;
    try {
      text = await expandSkillPrompt(input.text, this.state.cwd);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.state.agentStatus = "error";
      this.emit({ type: "agent/error", error: message });
      return;
    }
    const user: UiMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text,
      createdAt: Date.now(),
    };
    upsertMessage(this.state, user);
    this.emit({ type: "message/upsert", message: user });
    this.state.agentStatus = "running";
    this.emit({ type: "agent/running" });
    try {
      await client.prompt(text);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.state.agentStatus = "error";
      this.emit({ type: "agent/error", error: message });
      await this.recoverFromCrash();
      throw error instanceof Error ? error : new Error(message);
    }
  }

  async steer(text: string): Promise<void> {
    if (this.state.agentStatus !== "running") {
      await this.prompt({ text });
      return;
    }
    await (await this.requireClient()).steer(text);
    const message: UiMessage = {
      id: `steer-${Date.now()}`,
      role: "system",
      text: `已插入方向：${text}`,
      createdAt: Date.now(),
    };
    upsertMessage(this.state, message);
    this.emit({ type: "message/upsert", message });
  }

  async followUp(text: string): Promise<void> {
    if (this.state.agentStatus !== "running") {
      await this.prompt({ text });
      return;
    }
    await (await this.requireClient()).followUp(text);
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
    const client = this.client as (RpcClient & { clearQueue?: () => Promise<{ steering?: string[]; followUp?: string[] }> | { steering?: string[]; followUp?: string[] } }) | null;
    const queuedRaw = client?.clearQueue ? await client.clearQueue() : undefined;
    await this.client?.abort();
    const restoredDraft = queuedRaw
      ? [...(queuedRaw.steering ?? []), ...(queuedRaw.followUp ?? [])].join("\n").trim() || undefined
      : undefined;
    this.state.agentStatus = "idle";
    this.emit(restoredDraft ? { type: "agent/idle", restoredDraft } : { type: "agent/idle" });
    return restoredDraft;
  }

  async compact(instructions?: string): Promise<void> {
    if (this.state.agentStatus === "running") {
      throw new Error("等当前轮结束再压缩");
    }
    await (await this.requireClient()).compact(instructions);
    await this.reloadTranscript();
  }

  async listSessions(): Promise<SessionSummary[]> {
    await this.refreshSessions();
    return this.state.sessions;
  }

  async listModels(): Promise<ModelInfo[]> {
    const models = await (await this.requireClient()).getAvailableModels();
    this.state.models = models.map((model) => toModelInfo(model));
    return this.state.models;
  }

  async reloadModels(): Promise<ModelInfo[]> {
    return this.listModels();
  }

  async setModel(id: string): Promise<ModelInfo> {
    const slash = id.indexOf("/");
    const provider = slash > 0 ? id.slice(0, slash) : "unknown";
    const modelId = slash > 0 ? id.slice(slash + 1) : id;
    const result = await (await this.requireClient()).setModel(provider, modelId);
    const info = toModelInfo(result);
    this.state.model = info;
    return info;
  }

  async newSession(title?: string): Promise<SessionSummary> {
    if (this.state.agentStatus === "running") {
      throw new Error("等当前轮结束再新建会话");
    }
    const client = await this.requireClient();
    const result = await client.newSession();
    if (result.cancelled) {
      throw new Error("新建会话被取消");
    }
    if (title) {
      try {
        await client.setSessionName(title);
      } catch {
        /* name is best-effort; session still opened */
      }
    }
    return this.hydrateFromRpc(title);
  }

  async resumeSession(id: string): Promise<SessionSummary> {
    if (this.state.agentStatus === "running") {
      throw new Error("等当前轮结束再切换会话");
    }
    const result = await (await this.requireClient()).switchSession(id);
    if (result.cancelled) {
      throw new Error("恢复会话被取消");
    }
    return this.hydrateFromRpc();
  }

  async renameSession(id: string, title: string): Promise<SessionSummary> {
    if (this.state.agentStatus === "running") {
      throw new Error("等当前轮结束再重命名会话");
    }
    const nextTitle = title.trim();
    if (this.state.sessionId === id) {
      try {
        await (await this.requireClient()).setSessionName(nextTitle);
      } catch {
        /* sidecar name is best-effort; still persist to jsonl */
      }
    }
    const summary = id.endsWith(".jsonl")
      ? renameSessionFile(id, nextTitle)
      : { id, title: nextTitle, mtime: Date.now() };
    this.state.sessions = this.state.sessions.map((item) => (item.id === id ? { ...item, ...summary } : item));
    if (this.state.sessionId === id) {
      this.state.sessionTitle = summary.title;
    }
    await this.refreshSessions();
    return summary;
  }

  async deleteSession(id: string): Promise<SessionSummary | null> {
    if (this.state.agentStatus === "running") {
      throw new Error("等当前轮结束再删除会话");
    }
    const deletingCurrent = this.state.sessionId === id;
    if (id.endsWith(".jsonl")) {
      await deleteSessionFile(id);
    }
    this.state.sessions = this.state.sessions.filter((item) => item.id !== id);
    if (!deletingCurrent) {
      await this.refreshSessions();
      return this.state.sessions.find((item) => item.id === this.state.sessionId) ?? null;
    }
    const remaining = this.state.sessions;
    if (remaining[0]) {
      return this.resumeSession(remaining[0].id);
    }
    return this.newSession("新会话");
  }

  async fork(entryId: string): Promise<SessionSummary> {
    if (this.state.agentStatus === "running") {
      throw new Error("等当前轮结束再分叉");
    }
    const result = await (await this.requireClient()).fork(entryId);
    if (result.cancelled) {
      throw new Error("分叉被取消");
    }
    return this.hydrateFromRpc(`分叉 ${entryId.slice(0, 8)}`);
  }

  async navigate(entryId: string): Promise<void> {
    if (this.state.agentStatus === "running") {
      throw new Error("等当前轮结束再切换分支");
    }
    await this.refreshTreeFromRpc();
    const keep = pathIdsFrom(this.state.treeSeeds, entryId);
    if (keep.size === 0) {
      throw new Error("节点不存在");
    }
    this.state.currentEntryId = entryId;
    this.state.tree = buildTree(this.state.treeSeeds, entryId);
    if (this.state.tree) {
      this.emit({ type: "tree/changed", root: this.state.tree });
    }
  }

  async dispose(): Promise<void> {
    await this.client?.stop();
    this.client = null;
    this.listeners.clear();
  }

  private async requireClient(): Promise<RpcClient> {
    if (!this.client) {
      await this.restart(this.state.cwd ?? process.cwd());
    }
    if (!this.client) {
      throw new Error("RPC sidecar 未启动");
    }
    return this.client;
  }

  private async restart(cwd: string): Promise<void> {
    this.lastCwd = cwd;
    await this.client?.stop();
    this.client = new RpcClient({ cwd });
    try {
      await this.client.start();
      this.restarts = 0;
      this.client.onEvent((event) => {
        applyPiSessionEvent(this.state, event as { type: string } & Record<string, unknown>, (mapped) => this.emit(mapped), {
          captureArtifacts: true,
          onAgentEnd: () => {
            void this.reloadMessagesFromRpc();
            void this.refreshTreeFromRpc();
            void this.refreshUsageFromRpc();
          },
        });
      });
    } catch (error) {
      this.restarts += 1;
      if (this.restarts <= 3) {
        await this.restart(cwd);
        return;
      }
      throw new Error(`RPC sidecar 启动失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async hydrateFromRpc(fallbackTitle?: string): Promise<SessionSummary> {
    const client = await this.requireClient();
    let sessionFile: string | undefined;
    let sessionName: string | undefined;
    try {
      const rpcState = await client.getState();
      sessionFile = rpcState.sessionFile;
      sessionName = rpcState.sessionName;
    } catch {
      /* keep a local id if sidecar state is unavailable */
    }
    await this.reloadTranscript();
    const summary: SessionSummary = {
      id: sessionFile ?? this.state.sessionId ?? `rpc-${Date.now()}`,
      title: sessionName ?? fallbackTitle ?? this.state.sessionTitle ?? "RPC 会话",
      mtime: Date.now(),
    };
    this.state.sessionId = summary.id;
    this.state.sessionTitle = summary.title;
    if (!this.state.sessions.some((item) => item.id === summary.id)) {
      this.state.sessions.unshift(summary);
    }
    await this.refreshSessions();
    this.emit({ type: "session/replaced", sessionId: summary.id, title: summary.title });
    return summary;
  }

  private async reloadTranscript(): Promise<void> {
    const client = this.client;
    if (!client) {
      return;
    }
    resetConversation(this.state);
    await this.reloadMessagesFromRpc();
    await this.refreshTreeFromRpc();
    await this.refreshUsageFromRpc();
  }

  private async reloadMessagesFromRpc(): Promise<void> {
    const client = this.client;
    if (!client) {
      return;
    }
    this.state.messages = [];
    try {
      const { entries } = await client.getEntries();
      for (const entry of entries) {
        if (entry.type !== "message") {
          continue;
        }
        const ui = toUiMessage(entry.message, false, entry.id);
        if (ui) {
          upsertMessage(this.state, ui);
        }
      }
    } catch {
      try {
        const messages = await client.getMessages();
        for (const message of messages) {
          const ui = toUiMessage(message, false);
          if (ui) {
            upsertMessage(this.state, ui);
          }
        }
      } catch {
        /* empty transcript is still a valid new session */
      }
    }
  }

  private async refreshUsageFromRpc(): Promise<void> {
    const client = this.client;
    if (!client) {
      return;
    }
    try {
      const stats = await client.getSessionStats();
      this.state.usage = usageFromSessionStats(stats);
      this.emit({ type: "usage/update", tokens: this.state.usage });
    } catch {
      /* keep the last known usage if sidecar stats are unavailable */
    }
  }

  private async refreshSessions(): Promise<void> {
    const cwd = this.state.cwd;
    if (!cwd) {
      return;
    }
    try {
      const listed = await SessionManager.list(cwd);
      this.state.sessions = listed.map(toSessionSummary).sort((a, b) => b.mtime - a.mtime);
    } catch {
      /* keep the locally tracked session list if sidecar listing fails */
    }
  }

  private async refreshTreeFromRpc(): Promise<void> {
    const client = this.client;
    if (!client) {
      return;
    }
    try {
      const { tree, leafId } = await client.getTree();
      const seeds = seedsFromRpcTree(tree);
      this.state.treeSeeds = seeds;
      this.state.currentEntryId = leafId;
      this.state.tree = buildTree(seeds, leafId);
      if (this.state.tree) {
        this.emit({ type: "tree/changed", root: this.state.tree });
      }
    } catch {
      /* empty tree is still a valid new session */
    }
  }

  async recoverFromCrash(): Promise<void> {
    if (this.crashRestarts >= 3) {
      this.emit({ type: "agent/error", error: "RPC sidecar 连续崩溃 3 次，已停止自动重启" });
      return;
    }
    this.crashRestarts += 1;
    this.emit({
      type: "agent/error",
      error: `RPC sidecar 已崩溃，正在第 ${this.crashRestarts} 次重启`,
    });
    await this.restart(this.lastCwd ?? this.state.cwd ?? process.cwd());
  }

  private emit(event: AnvilEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
