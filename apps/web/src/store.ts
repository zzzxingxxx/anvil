import type {
  AgentStatus,
  ApprovalRequest,
  FileChange,
  ModelInfo,
  SessionSummary,
  ToolStatus,
  TaskSummary,
  TreeNode,
  UiMessage,
  Usage,
} from "@anvil/protocol";
import { create } from "zustand";

export type ConnectionStatus = "connecting" | "open" | "closed";
export type ActiveTab = "chat" | "board" | "settings";

export type ToolCard = {
  callId: string;
  name: string;
  args: unknown;
  status: ToolStatus;
  output: string;
};

export type FilePreview = {
  path: string;
  content: string;
  truncated?: boolean;
};

export type UiState = {
  connection: ConnectionStatus;
  cwd: string | null;
  trust: "untrusted" | "trusted";
  sessionId: string | null;
  sessionTitle: string | null;
  sessions: SessionSummary[];
  modelId: string | null;
  modelLabel: string | null;
  models: ModelInfo[];
  agentStatus: AgentStatus;
  messages: UiMessage[];
  tools: ToolCard[];
  usage: Usage;
  lastError: string | null;
  recentWorkspaces: string[];
  pendingApproval: ApprovalRequest | null;
  adapter: "fake" | "sdk" | "rpc" | null;
  preview: FilePreview | null;
  tree: TreeNode | null;
  changes: FileChange[];
  currentEntryId: string | null;
  commandOpen: boolean;
  tasks: TaskSummary[];
  settings: {
    trustDefault?: "trusted" | "untrusted";
    bashPolicy?: "ask" | "allowlist";
    bashAllowlist?: string[];
    defaultModel?: string;
  };
  docker: { available: boolean; version?: string; reason?: string } | null;

  activeTab: ActiveTab;
  sidebarOpen: boolean;
  inspectorOpen: boolean;
};

type Actions = {
  setConnection: (connection: ConnectionStatus) => void;
  setActiveTab: (tab: ActiveTab) => void;
  toggleSidebar: () => void;
  toggleInspector: () => void;
  applyEvent: (payload: unknown) => void;
  resetTransient: () => void;
  setPreview: (preview: FilePreview | null) => void;
  setCommandOpen: (open: boolean) => void;
};

const emptyUsage: Usage = { inputTokens: 0, outputTokens: 0 };

export const useUiStore = create<UiState & Actions>((set) => ({
  connection: "connecting",
  cwd: null,
  trust: "untrusted",
  sessionId: null,
  sessionTitle: "默认主会话",
  sessions: [],
  modelId: null,
  modelLabel: null,
  models: [],
  agentStatus: "idle",
  messages: [],
  tools: [],
  usage: emptyUsage,
  lastError: null,
  recentWorkspaces: [],
  pendingApproval: null,
  adapter: null,
  preview: null,
  tree: null,
  changes: [],
  currentEntryId: null,
  commandOpen: false,
  tasks: [],
  settings: {},
  docker: null,

  activeTab: "chat",
  sidebarOpen: true,
  inspectorOpen: true,

  setConnection: (connection) => set({ connection }),
  setActiveTab: (activeTab) => set({ activeTab }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleInspector: () => set((state) => ({ inspectorOpen: !state.inspectorOpen })),
  resetTransient: () => set({ lastError: null }),
  setPreview: (preview) => set({ preview }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),

  applyEvent: (payload) => {
    if (!payload || typeof payload !== "object" || !("type" in payload)) {
      return;
    }
    const event = payload as { type: string } & Record<string, unknown>;
    switch (event.type) {
      case "snapshot":
        set({
          cwd: (event.cwd as string | null) ?? null,
          trust: (event.trust as "untrusted" | "trusted") ?? "untrusted",
          sessionId: (event.sessionId as string | null) ?? null,
          sessionTitle: (event.sessionTitle as string | null) ?? "默认主会话",
          modelId: (event.modelId as string | null) ?? null,
          modelLabel: (event.modelLabel as string | null) ?? null,
          agentStatus: (event.agentStatus as AgentStatus) ?? "idle",
          messages: Array.isArray(event.messages) ? (event.messages as UiMessage[]) : [],
          tools: Array.isArray(event.tools) ? (event.tools as ToolCard[]) : [],
          usage: (event.usage as Usage) ?? emptyUsage,
          sessions: Array.isArray(event.sessions) ? (event.sessions as SessionSummary[]) : [],
          models: Array.isArray(event.models) ? (event.models as ModelInfo[]) : [],
          recentWorkspaces: Array.isArray(event.recentWorkspaces)
            ? (event.recentWorkspaces as string[])
            : [],
          pendingApproval: (event.pendingApproval as ApprovalRequest | null) ?? null,
          adapter: (event.adapter as "fake" | "sdk" | "rpc" | null) ?? null,
          tree: (event.tree as TreeNode | null) ?? null,
          changes: Array.isArray(event.changes) ? (event.changes as FileChange[]) : [],
          currentEntryId: (event.currentEntryId as string | null) ?? null,
          tasks: Array.isArray(event.tasks) ? (event.tasks as TaskSummary[]) : [],
          settings: (event.settings as UiState["settings"]) ?? {},
          docker: (event.docker as UiState["docker"]) ?? null,
        });
        break;
      case "session/replaced":
        set({
          sessionId: String(event.sessionId ?? ""),
          sessionTitle: String(event.title ?? "会话"),
          messages: [],
          tools: [],
          pendingApproval: null,
        });
        break;
      case "message/upsert": {
        const message = event.message as UiMessage;
        set((state) => {
          const index = state.messages.findIndex((item) => item.id === message.id);
          if (index === -1) {
            return { messages: [...state.messages, message] };
          }
          const next = state.messages.slice();
          next[index] = message;
          return { messages: next };
        });
        break;
      }
      case "tool/start":
        set((state) => ({
          tools: [
            ...state.tools.filter((tool) => tool.callId !== event.callId),
            {
              callId: String(event.callId),
              name: String(event.name),
              args: event.args,
              status: "running",
              output: "",
            },
          ],
        }));
        break;
      case "tool/update":
        set((state) => ({
          tools: state.tools.map((tool) =>
            tool.callId === event.callId
              ? { ...tool, output: `${tool.output}${String(event.partial ?? "")}` }
              : tool,
          ),
        }));
        break;
      case "tool/end":
        set((state) => ({
          tools: state.tools.map((tool) =>
            tool.callId === event.callId
              ? {
                  ...tool,
                  status: event.ok ? "success" : "error",
                  output:
                    typeof event.result === "string" ? event.result : JSON.stringify(event.result),
                }
              : tool,
          ),
        }));
        break;
      case "approval/needed":
        set({ pendingApproval: event.request as ApprovalRequest });
        break;
      case "tree/changed":
        set({ tree: event.root as TreeNode });
        break;
      case "fs/changed":
        if (Array.isArray(event.changes)) {
          set({ changes: event.changes as FileChange[] });
        }
        break;
      case "task/upsert": {
        const task = event.task as TaskSummary;
        set((state) => {
          const index = state.tasks.findIndex((item) => item.id === task.id);
          if (index === -1) {
            return { tasks: [task, ...state.tasks] };
          }
          const next = state.tasks.slice();
          next[index] = task;
          return { tasks: next };
        });
        break;
      }
      case "usage/update":
        set({ usage: event.tokens as Usage });
        break;
      case "agent/running":
        set({ agentStatus: "running", lastError: null });
        break;
      case "agent/idle":
        set({ agentStatus: "idle" });
        break;
      case "agent/error":
        set({ agentStatus: "error", lastError: String(event.error ?? "未知错误") });
        break;
      case "heartbeat":
        break;
      default:
        break;
    }
  },
}));
