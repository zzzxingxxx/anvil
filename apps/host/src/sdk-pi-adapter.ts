import {
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  SessionManager,
  type AgentSession,
  type AgentSessionEvent,
  type AgentSessionRuntime,
  type InlineExtension,
} from "@earendil-works/pi-coding-agent";
import type { AnvilEvent, ModelInfo, SessionSummary, UiMessage } from "@anvil/protocol";
import { decideGate, previewArgs, riskFor } from "@anvil/pi-ext-gate";
import type { ApprovalQueue } from "./approvals.ts";
import type { PiAdapter, PromptInput } from "./pi-adapter.ts";
import {
  eventFromSdk,
  messageText,
  parseModelKey,
  stringifyPartial,
  toModelInfo,
  toSessionSummary,
  toUiMessage,
  usageFromMessage,
} from "./sdk-map.ts";
import { captureAfter, captureBefore, toolPath } from "./artifacts.ts";
import { resetConversation, upsertMessage, upsertTool, type WorkspaceState } from "./state.ts";
import { recordUsage } from "./usage-ledger.ts";
import { buildTree, type TreeSeed } from "./tree.ts";

export class SdkPiAdapter implements PiAdapter {
  readonly kind = "sdk" as const;
  private listeners = new Set<(event: AnvilEvent) => void>();
  private runtime: AgentSessionRuntime | null = null;
  private unsubscribe: (() => void) | null = null;
  private starting: Promise<void> | null = null;

  constructor(
    private readonly state: WorkspaceState,
    private readonly approvals: ApprovalQueue,
  ) {}

  subscribe(cb: (event: AnvilEvent) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  async openWorkspace(cwd: string): Promise<void> {
    await this.replaceRuntime(cwd, SessionManager.create(cwd));
    await this.refreshSessions();
    await this.refreshModels();
    this.hydrateFromSession();
  }

  async prompt(input: PromptInput): Promise<void> {
    const session = await this.requireSession();
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
      await session.prompt(input.text, session.isStreaming ? { streamingBehavior: "followUp" } : undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.state.agentStatus = "error";
      this.emit({ type: "agent/error", error: chineseError(message) });
    }
  }

  async steer(text: string): Promise<void> {
    const session = await this.requireSession();
    await session.steer(text);
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
    const session = await this.requireSession();
    await session.followUp(text);
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
    const queued = this.runtime?.session.clearQueue();
    this.approvals.rejectAll();
    this.state.pendingApproval = null;
    if (this.runtime) {
      await this.runtime.session.abort();
    }
    if (queued && (queued.steering.length || queued.followUp.length)) {
      const text = [...queued.steering, ...queued.followUp].join("\n");
      const message: UiMessage = {
        id: `abort-queue-${Date.now()}`,
        role: "system",
        text: `已中止。队列已清空：${text}`,
        createdAt: Date.now(),
      };
      upsertMessage(this.state, message);
      this.emit({ type: "message/upsert", message });
    }
    this.state.agentStatus = "idle";
    this.emit({ type: "agent/idle" });
  }

  async listSessions(): Promise<SessionSummary[]> {
    await this.refreshSessions();
    return this.state.sessions;
  }

  async newSession(title?: string): Promise<SessionSummary> {
    const cwd = this.requireCwd();
    if (!this.runtime) {
      await this.replaceRuntime(cwd, SessionManager.create(cwd));
    } else {
      this.unsubscribe?.();
      this.unsubscribe = null;
      const result = await this.runtime.newSession();
      if (result.cancelled) {
        throw new Error("新建会话被取消");
      }
      this.bindSession(this.runtime.session);
    }
    const session = this.runtime!.session;
    if (title) {
      session.sessionManager.appendSessionInfo(title);
    }
    const summary: SessionSummary = {
      id: session.sessionFile ?? session.sessionId,
      title: title ?? session.sessionName ?? "新会话",
      mtime: Date.now(),
      tokens: 0,
    };
    this.applySession(summary);
    resetConversation(this.state);
    this.emit({ type: "session/replaced", sessionId: summary.id, title: summary.title });
    await this.refreshSessions();
    return summary;
  }

  async resumeSession(id: string): Promise<SessionSummary> {
    const cwd = this.requireCwd();
    if (!this.runtime) {
      await this.replaceRuntime(cwd, SessionManager.open(id));
    } else {
      this.unsubscribe?.();
      this.unsubscribe = null;
      const result = await this.runtime.switchSession(id);
      if (result.cancelled) {
        throw new Error("恢复会话被取消");
      }
      this.bindSession(this.runtime.session);
    }
    const session = this.runtime!.session;
    const summary: SessionSummary = {
      id: session.sessionFile ?? id,
      title: session.sessionName ?? firstTitle(session) ?? "已恢复会话",
      mtime: Date.now(),
    };
    this.applySession(summary);
    this.hydrateFromSession();
    this.emit({ type: "session/replaced", sessionId: summary.id, title: summary.title });
    await this.refreshSessions();
    return summary;
  }

  async listModels(): Promise<ModelInfo[]> {
    await this.refreshModels();
    return this.state.models;
  }

  async setModel(id: string): Promise<ModelInfo> {
    const session = await this.requireSession();
    const { provider, id: modelId } = parseModelKey(id);
    const found = session.modelRuntime.getModel(provider, modelId);
    if (!found) {
      throw new Error("模型不存在或尚未配置");
    }
    await session.setModel(found);
    const info = toModelInfo(found);
    this.state.model = info;
    return info;
  }

  async fork(entryId: string): Promise<SessionSummary> {
    const runtime = this.runtime;
    if (!runtime) {
      throw new Error("请先打开工作区");
    }
    if (this.state.agentStatus === "running") {
      throw new Error("等当前轮结束再分叉");
    }
    this.unsubscribe?.();
    this.unsubscribe = null;
    const result = await runtime.fork(entryId, { position: "at" });
    if (result.cancelled) {
      throw new Error("分叉被取消");
    }
    this.bindSession(runtime.session);
    const session = runtime.session;
    const summary: SessionSummary = {
      id: session.sessionFile ?? session.sessionId,
      title: session.sessionName ?? `分叉 ${entryId.slice(0, 8)}`,
      mtime: Date.now(),
    };
    this.applySession(summary);
    this.hydrateFromSession();
    this.emit({ type: "session/replaced", sessionId: summary.id, title: summary.title });
    await this.refreshSessions();
    return summary;
  }

  async navigate(entryId: string): Promise<void> {
    const session = await this.requireSession();
    if (this.state.agentStatus === "running") {
      throw new Error("等当前轮结束再切换分支");
    }
    const result = await session.navigateTree(entryId);
    if (result.cancelled) {
      throw new Error("导航被取消");
    }
    this.hydrateFromSession();
  }

  async compact(instructions?: string): Promise<void> {
    const session = await this.requireSession();
    if (this.state.agentStatus === "running") {
      throw new Error("等当前轮结束再压缩");
    }
    await session.compact(instructions);
    this.hydrateFromSession();
  }

  async dispose(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.approvals.rejectAll();
    await this.runtime?.dispose();
    this.runtime = null;
    this.listeners.clear();
  }

  private async requireSession(): Promise<AgentSession> {
    if (!this.runtime) {
      const cwd = this.requireCwd();
      await this.replaceRuntime(cwd, SessionManager.create(cwd));
    }
    return this.runtime!.session;
  }

  private requireCwd(): string {
    if (!this.state.cwd) {
      throw new Error("请先打开一个工作区目录");
    }
    return this.state.cwd;
  }

  private async replaceRuntime(cwd: string, manager: SessionManager): Promise<void> {
    if (this.starting) {
      await this.starting;
    }
    this.starting = this.replaceRuntimeNow(cwd, manager);
    try {
      await this.starting;
    } finally {
      this.starting = null;
    }
  }

  private async replaceRuntimeNow(cwd: string, manager: SessionManager): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
    await this.runtime?.dispose();
    this.runtime = null;

    const runtime = await createAgentSessionRuntime(
      async ({ cwd: nextCwd, agentDir, sessionManager, sessionStartEvent }) => {
        const services = await createAgentSessionServices({
          cwd: nextCwd,
          agentDir,
          resourceLoaderOptions: {
            extensionFactories: [this.gateExtension()],
          },
        });
        const created = await createAgentSessionFromServices({
          services,
          sessionManager,
          sessionStartEvent,
        });
        return { ...created, services, diagnostics: services.diagnostics };
      },
      { cwd, agentDir: getAgentDir(), sessionManager: manager },
    );

    this.runtime = runtime;
    this.bindSession(runtime.session);
    this.applySession({
      id: runtime.session.sessionFile ?? runtime.session.sessionId,
      title: runtime.session.sessionName ?? "当前会话",
      mtime: Date.now(),
    });
    if (runtime.session.model) {
      this.state.model = toModelInfo(runtime.session.model);
    }
  }

  private bindSession(session: AgentSession): void {
    this.unsubscribe?.();
    this.unsubscribe = session.subscribe((event) => this.onSdkEvent(event));
  }

  private applySession(summary: SessionSummary): void {
    this.state.sessionId = summary.id;
    this.state.sessionTitle = summary.title;
  }

  private hydrateFromSession(): void {
    const session = this.runtime?.session;
    if (!session) {
      return;
    }
    resetConversation(this.state);
    for (const message of session.messages) {
      const ui = toUiMessage(message, false);
      if (ui) {
        upsertMessage(this.state, ui);
      }
    }
    const stats = session.getSessionStats();
    this.state.usage = {
      inputTokens: stats.tokens.input,
      outputTokens: stats.tokens.output,
      cacheReadTokens: stats.tokens.cacheRead,
      cacheWriteTokens: stats.tokens.cacheWrite,
      costUsd: stats.cost,
    };
    if (session.model) {
      this.state.model = toModelInfo(session.model);
    }
    this.refreshTreeFromSdk(session);
  }

  private refreshTreeFromSdk(session: AgentSession): void {
    const entries = session.sessionManager.getEntries();
    const seeds: TreeSeed[] = entries.map((entry) => {
      const message = "message" in entry ? (entry as { message?: unknown }).message : undefined;
      const summary =
        session.sessionManager.getLabel(entry.id) ||
        (typeof (entry as { summary?: string }).summary === "string"
          ? (entry as { summary: string }).summary
          : messageText(message) || entry.type);
      const status: TreeSeed["status"] =
        entry.type === "compaction" || entry.type === "branch_summary" ? "compressed" : "ok";
      return {
        id: entry.id,
        parentId: entry.parentId,
        summary: summary.slice(0, 48) || entry.type,
        status,
      };
    });
    const leaf = session.sessionManager.getLeafId();
    this.state.treeSeeds = seeds;
    this.state.currentEntryId = leaf;
    this.state.tree = buildTree(seeds, leaf);
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
    const listed = await SessionManager.list(cwd);
    this.state.sessions = listed
      .map(toSessionSummary)
      .sort((a, b) => b.mtime - a.mtime);
  }

  private async refreshModels(): Promise<void> {
    const runtime = this.runtime;
    if (!runtime) {
      this.state.models = [];
      return;
    }
    const available = await runtime.session.modelRuntime.getAvailable();
    this.state.models = available.map(toModelInfo);
    if (!this.state.model && runtime.session.model) {
      this.state.model = toModelInfo(runtime.session.model);
    }
  }

  private gateExtension(): InlineExtension {
    return {
      name: "anvil-gate",
      factory: (pi) => {
        pi.on("tool_call", async (event) => {
          const args = "input" in event ? event.input : {};
          const gate = decideGate({
            toolName: event.toolName,
            args,
            trust: this.state.trust,
            cwd: this.state.cwd,
            bashPolicy: this.state.settings.bashPolicy,
            bashAllowlist: this.state.settings.bashAllowlist,
          });
          if (gate.decision === "allow") {
            return;
          }
          if (gate.decision === "deny") {
            return { block: true, reason: gate.reason };
          }
          const request = {
            requestId: event.toolCallId,
            toolName: event.toolName,
            argsPreview: previewArgs(args),
            risk: riskFor(event.toolName, args),
          };
          this.state.pendingApproval = request;
          const waited = this.approvals.wait(request);
          this.emit({ type: "approval/needed", request });
          const decision = await waited;
          this.state.pendingApproval = null;
          if (decision !== "allow-once") {
            return { block: true, reason: "用户拒绝了这次工具调用" };
          }
          return;
        });
      },
    };
  }

  private onSdkEvent(event: AgentSessionEvent): void {
    const mapped = eventFromSdk(event);
    if (mapped) {
      if (mapped.type === "agent/running") {
        this.state.agentStatus = "running";
      }
      if (mapped.type === "agent/idle") {
        this.state.agentStatus = "idle";
      }
      this.emit(mapped);
    }

    if (event.type === "message_start" || event.type === "message_update" || event.type === "message_end") {
      const streaming = event.type !== "message_end";
      const ui = toUiMessage(event.message, streaming);
      if (ui) {
        upsertMessage(this.state, ui);
        this.emit({ type: "message/upsert", message: ui });
      }
      const nextUsage = usageFromMessage(event.message, this.state.usage);
      if (event.type === "message_end" && nextUsage) {
        const delta = {
          inputTokens: Math.max(0, nextUsage.inputTokens - this.state.usage.inputTokens),
          outputTokens: Math.max(0, nextUsage.outputTokens - this.state.usage.outputTokens),
          costUsd: Math.max(0, (nextUsage.costUsd ?? 0) - (this.state.usage.costUsd ?? 0)),
        };
        this.state.usage = nextUsage;
        this.emit({ type: "usage/update", tokens: nextUsage });
        void recordUsage(delta);
      }
    }

    if (event.type === "tool_execution_start") {
      upsertTool(this.state, {
        callId: event.toolCallId,
        name: event.toolName,
        args: event.args,
        status: "running",
        output: "",
      });
      this.emit({
        type: "tool/start",
        callId: event.toolCallId,
        name: event.toolName,
        args: event.args,
      });
      const path = toolPath(event.args);
      if (path && (event.toolName === "write" || event.toolName === "edit")) {
        void captureBefore(this.state, path);
      }
    }

    if (event.type === "tool_execution_update") {
      const partial = stringifyPartial(event.partialResult);
      const existing = this.state.tools.find((item) => item.callId === event.toolCallId);
      upsertTool(this.state, {
        callId: event.toolCallId,
        name: event.toolName,
        args: event.args,
        status: "running",
        output: existing ? `${existing.output}${partial}` : partial,
      });
      this.emit({ type: "tool/update", callId: event.toolCallId, partial });
    }

    if (event.type === "tool_execution_end") {
      const output = stringifyPartial(event.result);
      upsertTool(this.state, {
        callId: event.toolCallId,
        name: event.toolName,
        args: {},
        status: event.isError ? "error" : "success",
        output,
      });
      this.emit({
        type: "tool/end",
        callId: event.toolCallId,
        ok: !event.isError,
        result: output,
      });
      const path = toolPath(this.state.tools.find((item) => item.callId === event.toolCallId)?.args);
      if (!event.isError && path && (event.toolName === "write" || event.toolName === "edit")) {
        void captureAfter(this.state, path).then(() => {
          this.emit({
            type: "fs/changed",
            paths: [path],
            changes: this.state.changes,
          });
        });
      }
    }

    if (event.type === "agent_end") {
      const last = this.state.messages.at(-1);
      if (last?.streaming) {
        last.streaming = false;
        this.emit({ type: "message/upsert", message: { ...last } });
      }
      if (this.runtime) {
        this.refreshTreeFromSdk(this.runtime.session);
      }
    }
  }

  private emit(event: AnvilEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

function firstTitle(session: AgentSession): string | null {
  const first = session.messages.find((message) => (message as { role?: string }).role === "user");
  const text = first ? messageText(first) : "";
  return text.split(/\r?\n/).find((line) => line.trim())?.slice(0, 48) ?? null;
}

function chineseError(message: string): string {
  if (/api key|auth|credential|unauthorized/i.test(message)) {
    return "没有可用模型。请设置 ANTHROPIC_API_KEY / DEEPSEEK_API_KEY，或在终端运行 pi 登录。";
  }
  if (/no model/i.test(message)) {
    return "尚未选择模型。请先在顶栏切换一个已配置的模型。";
  }
  return message;
}
