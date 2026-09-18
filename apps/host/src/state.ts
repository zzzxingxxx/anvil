import type {
  AgentStatus,
  ApprovalRequest,
  FileChange,
  ModelInfo,
  SessionSummary,
  ToolStatus,
  TaskSummary,
  TreeNode,
  TrustLevel,
  UiMessage,
  Usage,
} from "@anvil/protocol";
import type { AdapterKind } from "./pi-adapter.ts";
import type { TreeSeed } from "./tree.ts";

export type ToolCard = {
  callId: string;
  name: string;
  args: unknown;
  status: ToolStatus;
  output: string;
  startedAt?: number;
  endedAt?: number;
};

export type WorkspaceState = {
  cwd: string | null;
  trust: TrustLevel;
  sessionId: string | null;
  sessionTitle: string | null;
  sessions: SessionSummary[];
  model: ModelInfo | null;
  models: ModelInfo[];
  agentStatus: AgentStatus;
  messages: UiMessage[];
  tools: ToolCard[];
  usage: Usage;
  recentWorkspaces: string[];
  pendingApproval: ApprovalRequest | null;
  adapterKind: AdapterKind;
  tree: TreeNode | null;
  treeSeeds: TreeSeed[];
  currentEntryId: string | null;
  changes: FileChange[];
  snapshots: Record<string, { before: string | null; after: string | null }>;
  tasks: TaskSummary[];
  settings: {
    trustDefault?: "trusted" | "untrusted";
    bashPolicy?: "ask" | "allowlist";
    bashAllowlist?: string[];
    defaultModel?: string;
    personaModels?: {
      architect?: string;
      implementer?: string;
      reviewer?: string;
    };
  };
  docker: { available: boolean; version?: string; reason?: string };
};

export function createWorkspaceState(kind: AdapterKind = "fake"): WorkspaceState {
  const now = Date.now();
  const sessionId = kind === "fake" ? "sess-fake-1" : null;
  return {
    cwd: null,
    trust: "untrusted",
    sessionId,
    sessionTitle: kind === "fake" ? "演示会话" : null,
    sessions:
      kind === "fake"
        ? [{ id: sessionId!, title: "演示会话", mtime: now, tokens: 0 }]
        : [],
    model:
      kind === "fake"
        ? {
            id: "fake/anvil-echo",
            label: "Anvil Echo（假模型）",
            provider: "fake",
          }
        : null,
    models:
      kind === "fake"
        ? [
            {
              id: "fake/anvil-echo",
              label: "Anvil Echo（假模型）",
              provider: "fake",
            },
          ]
        : [],
    agentStatus: "idle",
    messages: [],
    tools: [],
    usage: { inputTokens: 0, outputTokens: 0 },
    recentWorkspaces: [],
    pendingApproval: null,
    adapterKind: kind,
    tree: null,
    treeSeeds: [],
    currentEntryId: null,
    changes: [],
    snapshots: {},
    tasks: [],
    settings: {},
    docker: { available: false, reason: "未探测" },
  };
}

export function resetConversation(state: WorkspaceState): void {
  state.messages = [];
  state.tools = [];
  state.pendingApproval = null;
  state.agentStatus = "idle";
  state.tree = null;
  state.treeSeeds = [];
  state.currentEntryId = null;
  state.changes = [];
  state.usage = { inputTokens: 0, outputTokens: 0 };
}

export function upsertMessage(state: WorkspaceState, message: UiMessage): void {
  const index = state.messages.findIndex((item) => item.id === message.id);
  if (index === -1) {
    state.messages.push(message);
    return;
  }
  state.messages[index] = message;
}

export function upsertTool(state: WorkspaceState, card: ToolCard): void {
  const index = state.tools.findIndex((item) => item.callId === card.callId);
  const previous = index === -1 ? undefined : state.tools[index];
  const next: ToolCard = { ...previous, ...card };
  if (next.status === "running" && next.startedAt == null) {
    next.startedAt = previous?.startedAt ?? Date.now();
  }
  if ((next.status === "success" || next.status === "error") && next.endedAt == null) {
    next.endedAt = Date.now();
  }
  if (index === -1) {
    state.tools.push(next);
    return;
  }
  state.tools[index] = next;
}

export function dropExpiredApproval(state: WorkspaceState, now = Date.now()): void {
  const expiresAt = state.pendingApproval?.expiresAt;
  if (expiresAt != null && expiresAt <= now) {
    state.pendingApproval = null;
  }
}

export function settleIdleTools(state: WorkspaceState): void {
  if (state.agentStatus === "running") {
    return;
  }
  for (const tool of state.tools) {
    if (tool.status !== "running" && tool.status !== "queued") {
      continue;
    }
    tool.status = "error";
    tool.endedAt = tool.endedAt ?? Date.now();
    tool.output = tool.output || "刷新时该工具已结束，避免永久转圈。";
  }
}
