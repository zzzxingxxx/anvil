import { RpcClient } from "@earendil-works/pi-coding-agent";
import type { AnvilEvent, ModelInfo, SessionSummary, UiMessage } from "@anvil/protocol";
import type { PiAdapter, PromptInput } from "./pi-adapter.ts";
import { resetConversation, upsertMessage, type WorkspaceState } from "./state.ts";
import { toModelInfo } from "./sdk-map.ts";

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
  }

  async prompt(input: PromptInput): Promise<void> {
    const client = await this.requireClient();
    const user: UiMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: input.text,
      createdAt: Date.now(),
    };
    upsertMessage(this.state, user);
    this.emit({ type: "message/upsert", message: user });
    this.state.agentStatus = "running";
    this.emit({ type: "agent/running" });
    try {
      await client.prompt(input.text);
    } catch (error) {
      await this.recoverFromCrash();
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async steer(text: string): Promise<void> {
    await (await this.requireClient()).steer(text);
  }

  async followUp(text: string): Promise<void> {
    await (await this.requireClient()).followUp(text);
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
  }

  async listModels(): Promise<ModelInfo[]> {
    const models = await (await this.requireClient()).getAvailableModels();
    this.state.models = models.map((model) => toModelInfo(model));
    return this.state.models;
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

  async newSession(): Promise<SessionSummary> {
    if (this.state.agentStatus === "running") {
      throw new Error("等当前轮结束再新建会话");
    }
    const client = await this.requireClient();
    const result = await client.newSession();
    if (result.cancelled) {
      throw new Error("新建会话被取消");
    }
    resetConversation(this.state);
    const summary: SessionSummary = {
      id: `rpc-${Date.now()}`,
      title: "RPC 会话",
      mtime: Date.now(),
    };
    this.state.sessionId = summary.id;
    this.state.sessionTitle = summary.title;
    this.state.sessions.unshift(summary);
    return summary;
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
        const type = (event as { type?: string }).type;
        if (type === "agent_start") {
          this.state.agentStatus = "running";
          this.emit({ type: "agent/running" });
        }
        if (type === "agent_end" || type === "agent_settled") {
          this.state.agentStatus = "idle";
          this.emit({ type: "agent/idle" });
        }
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
