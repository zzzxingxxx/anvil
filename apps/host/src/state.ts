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
  if (index === -1) {
    state.tools.push(card);
    return;
  }
  state.tools[index] = { ...state.tools[index], ...card };
}
