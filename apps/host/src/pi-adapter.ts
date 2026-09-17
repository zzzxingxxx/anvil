import type { AnvilEvent, ModelInfo, SessionSummary } from "@anvil/protocol";
import type { ApprovalQueue } from "./approvals.ts";
import type { WorkspaceState } from "./state.ts";

export type PromptInput = {
  text: string;
};

export type AdapterKind = "fake" | "sdk" | "rpc";

export interface PiAdapter {
  readonly kind: AdapterKind;
  prompt(input: PromptInput): Promise<void>;
  steer(text: string): Promise<void>;
  followUp(text: string): Promise<void>;
  abort(): Promise<void>;
  subscribe(cb: (event: AnvilEvent) => void): () => void;
  dispose(): Promise<void>;
  openWorkspace?(cwd: string): Promise<void>;
  listSessions?(): Promise<SessionSummary[]>;
  newSession?(title?: string): Promise<SessionSummary>;
  resumeSession?(id: string): Promise<SessionSummary>;
  listModels?(): Promise<ModelInfo[]>;
  setModel?(id: string): Promise<ModelInfo>;
  fork?(entryId: string): Promise<SessionSummary>;
  navigate?(entryId: string): Promise<void>;
  compact?(instructions?: string): Promise<void>;
}

export type AdapterContext = {
  state: WorkspaceState;
  approvals: ApprovalQueue;
};
