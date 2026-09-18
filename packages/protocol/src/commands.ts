import { z } from "zod";

export const TrustLevelSchema = z.enum(["untrusted", "trusted"]);
export type TrustLevel = z.infer<typeof TrustLevelSchema>;

export const AgentStatusSchema = z.enum(["idle", "running", "error"]);
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

export const TaskStatusSchema = z.enum([
  "queued",
  "running",
  "waiting_approval",
  "succeeded",
  "failed",
  "cancelled",
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskPersonaSchema = z.enum(["architect", "implementer", "reviewer"]);
export type TaskPersona = z.infer<typeof TaskPersonaSchema>;

export const TaskSummarySchema = z.object({
  id: z.string(),
  parentSessionId: z.string().nullable(),
  sessionId: z.string().nullable(),
  persona: z.string(),
  goal: z.string(),
  status: TaskStatusSchema,
  cwd: z.string().optional(),
  error: z.string().optional(),
  summary: z.string().optional(),
  startedAt: z.number(),
  endedAt: z.number().optional(),
  costUsd: z.number().optional(),
  column: z.enum(["todo", "doing", "blocked", "done"]).optional(),
});
export type TaskSummary = z.infer<typeof TaskSummarySchema>;

export const WorkspaceOpenPayloadSchema = z.object({
  path: z.string().min(1),
  trust: TrustLevelSchema.optional(),
});
export type WorkspaceOpenPayload = z.infer<typeof WorkspaceOpenPayloadSchema>;

export const WorkspaceOpenResultSchema = z.object({
  ok: z.literal(true),
  path: z.string(),
  trust: TrustLevelSchema,
  recent: z.array(z.string()).optional(),
});
export type WorkspaceOpenResult = z.infer<typeof WorkspaceOpenResultSchema>;

export const WorkspaceTrustPayloadSchema = z.object({
  trust: TrustLevelSchema,
});
export type WorkspaceTrustPayload = z.infer<typeof WorkspaceTrustPayloadSchema>;

export const WorkspaceTrustResultSchema = z.object({
  ok: z.literal(true),
  path: z.string(),
  trust: TrustLevelSchema,
});
export type WorkspaceTrustResult = z.infer<typeof WorkspaceTrustResultSchema>;

export const SessionListPayloadSchema = z.object({}).strict();
export type SessionListPayload = z.infer<typeof SessionListPayloadSchema>;

export const SessionSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  mtime: z.number(),
  tokens: z.number().optional(),
});
export type SessionSummary = z.infer<typeof SessionSummarySchema>;

export const SessionListResultSchema = z.object({
  ok: z.literal(true),
  sessions: z.array(SessionSummarySchema),
  currentId: z.string().nullable(),
});
export type SessionListResult = z.infer<typeof SessionListResultSchema>;

export const SessionNewPayloadSchema = z.object({
  title: z.string().optional(),
});
export type SessionNewPayload = z.infer<typeof SessionNewPayloadSchema>;

export const SessionRefSchema = z.object({
  id: z.string(),
  title: z.string(),
});
export type SessionRef = z.infer<typeof SessionRefSchema>;

export const SessionNewResultSchema = z.object({
  ok: z.literal(true),
  session: SessionRefSchema,
});
export type SessionNewResult = z.infer<typeof SessionNewResultSchema>;

export const SessionResumePayloadSchema = z.object({
  id: z.string().min(1),
});
export type SessionResumePayload = z.infer<typeof SessionResumePayloadSchema>;

export const SessionResumeResultSchema = SessionNewResultSchema;
export type SessionResumeResult = z.infer<typeof SessionResumeResultSchema>;

export const AgentPromptPayloadSchema = z.object({
  text: z.string().min(1),
  images: z
    .array(
      z.object({
        mimeType: z.string(),
        data: z.string(),
      }),
    )
    .optional(),
});
export type AgentPromptPayload = z.infer<typeof AgentPromptPayloadSchema>;

export const AgentOkResultSchema = z.object({
  ok: z.literal(true),
});
export type AgentOkResult = z.infer<typeof AgentOkResultSchema>;

export const AgentAbortResultSchema = z.object({
  ok: z.literal(true),
  restoredDraft: z.string().optional(),
});
export type AgentAbortResult = z.infer<typeof AgentAbortResultSchema>;

export const AgentSteerPayloadSchema = z.object({
  text: z.string().min(1),
});
export type AgentSteerPayload = z.infer<typeof AgentSteerPayloadSchema>;

export const AgentFollowUpPayloadSchema = z.object({
  text: z.string().min(1),
});
export type AgentFollowUpPayload = z.infer<typeof AgentFollowUpPayloadSchema>;

export const AgentAbortPayloadSchema = z.object({}).strict();
export type AgentAbortPayload = z.infer<typeof AgentAbortPayloadSchema>;

export const ApprovalDecisionSchema = z.enum(["allow-once", "deny"]);
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;

export const ApprovalRespondPayloadSchema = z.object({
  requestId: z.string().min(1),
  decision: ApprovalDecisionSchema,
});
export type ApprovalRespondPayload = z.infer<typeof ApprovalRespondPayloadSchema>;

export const ModelListPayloadSchema = z.object({}).strict();
export type ModelListPayload = z.infer<typeof ModelListPayloadSchema>;

export const ModelInfoSchema = z.object({
  id: z.string(),
  label: z.string(),
  provider: z.string(),
});
export type ModelInfo = z.infer<typeof ModelInfoSchema>;

export const ModelListResultSchema = z.object({
  ok: z.literal(true),
  models: z.array(ModelInfoSchema),
  currentId: z.string().nullable(),
});
export type ModelListResult = z.infer<typeof ModelListResultSchema>;

export const ModelSetPayloadSchema = z.object({
  id: z.string().min(1),
});
export type ModelSetPayload = z.infer<typeof ModelSetPayloadSchema>;

export const ModelSetResultSchema = z.object({
  ok: z.literal(true),
  model: ModelInfoSchema,
});
export type ModelSetResult = z.infer<typeof ModelSetResultSchema>;

export const FsTreePayloadSchema = z.object({
  path: z.string().optional(),
});
export type FsTreePayload = z.infer<typeof FsTreePayloadSchema>;

export const FsEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  kind: z.enum(["file", "dir"]),
});
export type FsEntry = z.infer<typeof FsEntrySchema>;

export const FsTreeResultSchema = z.object({
  ok: z.literal(true),
  path: z.string(),
  entries: z.array(FsEntrySchema),
});
export type FsTreeResult = z.infer<typeof FsTreeResultSchema>;

export const FsReadPayloadSchema = z.object({
  path: z.string().min(1),
});
export type FsReadPayload = z.infer<typeof FsReadPayloadSchema>;

export const FsReadResultSchema = z.object({
  ok: z.literal(true),
  path: z.string(),
  content: z.string(),
  truncated: z.boolean().optional(),
});
export type FsReadResult = z.infer<typeof FsReadResultSchema>;

export const SessionForkPayloadSchema = z.object({
  entryId: z.string().min(1),
});
export type SessionForkPayload = z.infer<typeof SessionForkPayloadSchema>;

export const SessionForkResultSchema = SessionNewResultSchema;
export type SessionForkResult = z.infer<typeof SessionForkResultSchema>;

export const TreeNavigatePayloadSchema = z.object({
  entryId: z.string().min(1),
});
export type TreeNavigatePayload = z.infer<typeof TreeNavigatePayloadSchema>;

export const SessionCompactPayloadSchema = z.object({
  instructions: z.string().optional(),
});
export type SessionCompactPayload = z.infer<typeof SessionCompactPayloadSchema>;

export const FsSearchPayloadSchema = z.object({
  query: z.string().min(1),
});
export type FsSearchPayload = z.infer<typeof FsSearchPayloadSchema>;

export const FsSearchHitSchema = z.object({
  path: z.string(),
  name: z.string(),
});
export type FsSearchHit = z.infer<typeof FsSearchHitSchema>;

export const FsSearchResultSchema = z.object({
  ok: z.literal(true),
  hits: z.array(FsSearchHitSchema),
});
export type FsSearchResult = z.infer<typeof FsSearchResultSchema>;

export const ArtifactRestorePayloadSchema = z.object({
  path: z.string().min(1),
});
export type ArtifactRestorePayload = z.infer<typeof ArtifactRestorePayloadSchema>;

export const ArtifactListPayloadSchema = z.object({}).strict();
export const ArtifactItemSchema = z.object({
  path: z.string(),
  kind: z.enum(["snapshot", "other"]),
  mtime: z.number().optional(),
});
export type ArtifactItem = z.infer<typeof ArtifactItemSchema>;
export const ArtifactListResultSchema = z.object({
  ok: z.literal(true),
  items: z.array(ArtifactItemSchema),
});

export const TaskDelegatePayloadSchema = z.object({
  goal: z.string().min(1),
  persona: z.enum(["architect", "implementer", "reviewer"]).default("implementer"),
  cwd: z.string().optional(),
  timeoutSec: z.number().optional(),
  maxUsd: z.number().optional(),
});
export type TaskDelegatePayload = z.infer<typeof TaskDelegatePayloadSchema>;

export const TaskCancelPayloadSchema = z.object({
  id: z.string().min(1),
});
export type TaskCancelPayload = z.infer<typeof TaskCancelPayloadSchema>;

export const TaskListPayloadSchema = z.object({}).strict();
export type TaskListPayload = z.infer<typeof TaskListPayloadSchema>;

export const TaskDelegateResultSchema = z.object({
  ok: z.literal(true),
  task: TaskSummarySchema,
});
export type TaskDelegateResult = z.infer<typeof TaskDelegateResultSchema>;

export const TaskListResultSchema = z.object({
  ok: z.literal(true),
  tasks: z.array(TaskSummarySchema),
});
export type TaskListResult = z.infer<typeof TaskListResultSchema>;

export const BoardColumnSchema = z.enum(["todo", "doing", "blocked", "done"]);
export type BoardColumn = z.infer<typeof BoardColumnSchema>;

export const BoardMovePayloadSchema = z.object({
  id: z.string().min(1),
  column: BoardColumnSchema,
});
export type BoardMovePayload = z.infer<typeof BoardMovePayloadSchema>;

export const SettingsSchema = z.object({
  trustDefault: TrustLevelSchema.optional(),
  bashPolicy: z.enum(["ask", "allowlist"]).optional(),
  bashAllowlist: z.array(z.string()).optional(),
  defaultModel: z.string().optional(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const SettingsGetPayloadSchema = z.object({}).strict();
export const SettingsSetPayloadSchema = SettingsSchema;
export const SettingsResultSchema = z.object({
  ok: z.literal(true),
  settings: SettingsSchema,
});

export const UsageExportPayloadSchema = z.object({}).strict();
export const UsageDaySchema = z.object({
  day: z.string(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  cacheReadTokens: z.number().optional(),
  cacheWriteTokens: z.number().optional(),
  costUsd: z.number(),
});
export const UsageExportResultSchema = z.object({
  ok: z.literal(true),
  text: z.string(),
  days: z.array(UsageDaySchema),
  sessionFile: z.string().nullable(),
});

export const CommandTypeSchema = z.enum([
  "workspace.open",
  "workspace.trust",
  "session.list",
  "session.new",
  "session.resume",
  "session.fork",
  "session.compact",
  "tree.navigate",
  "agent.prompt",
  "agent.steer",
  "agent.followUp",
  "agent.abort",
  "approval.respond",
  "model.list",
  "model.set",
  "fs.tree",
  "fs.read",
  "fs.search",
  "artifact.restore",
  "artifact.list",
  "task.delegate",
  "task.cancel",
  "task.list",
  "board.move",
  "settings.get",
  "settings.set",
  "usage.export",
]);
export type CommandType = z.infer<typeof CommandTypeSchema>;

export const CommandPayloadSchemas = {
  "workspace.open": WorkspaceOpenPayloadSchema,
  "workspace.trust": WorkspaceTrustPayloadSchema,
  "session.list": SessionListPayloadSchema,
  "session.new": SessionNewPayloadSchema,
  "session.resume": SessionResumePayloadSchema,
  "session.fork": SessionForkPayloadSchema,
  "session.compact": SessionCompactPayloadSchema,
  "tree.navigate": TreeNavigatePayloadSchema,
  "agent.prompt": AgentPromptPayloadSchema,
  "agent.steer": AgentSteerPayloadSchema,
  "agent.followUp": AgentFollowUpPayloadSchema,
  "agent.abort": AgentAbortPayloadSchema,
  "approval.respond": ApprovalRespondPayloadSchema,
  "model.list": ModelListPayloadSchema,
  "model.set": ModelSetPayloadSchema,
  "fs.tree": FsTreePayloadSchema,
  "fs.read": FsReadPayloadSchema,
  "fs.search": FsSearchPayloadSchema,
  "artifact.restore": ArtifactRestorePayloadSchema,
  "artifact.list": ArtifactListPayloadSchema,
  "task.delegate": TaskDelegatePayloadSchema,
  "task.cancel": TaskCancelPayloadSchema,
  "task.list": TaskListPayloadSchema,
  "board.move": BoardMovePayloadSchema,
  "settings.get": SettingsGetPayloadSchema,
  "settings.set": SettingsSetPayloadSchema,
  "usage.export": UsageExportPayloadSchema,
} as const;

export const CommandResultSchemas = {
  "workspace.open": WorkspaceOpenResultSchema,
  "workspace.trust": WorkspaceTrustResultSchema,
  "session.list": SessionListResultSchema,
  "session.new": SessionNewResultSchema,
  "session.resume": SessionResumeResultSchema,
  "session.fork": SessionForkResultSchema,
  "session.compact": AgentOkResultSchema,
  "tree.navigate": AgentOkResultSchema,
  "agent.prompt": AgentOkResultSchema,
  "agent.steer": AgentOkResultSchema,
  "agent.followUp": AgentOkResultSchema,
  "agent.abort": AgentAbortResultSchema,
  "approval.respond": AgentOkResultSchema,
  "model.list": ModelListResultSchema,
  "model.set": ModelSetResultSchema,
  "fs.tree": FsTreeResultSchema,
  "fs.read": FsReadResultSchema,
  "fs.search": FsSearchResultSchema,
  "artifact.restore": AgentOkResultSchema,
  "artifact.list": ArtifactListResultSchema,
  "task.delegate": TaskDelegateResultSchema,
  "task.cancel": AgentOkResultSchema,
  "task.list": TaskListResultSchema,
  "board.move": AgentOkResultSchema,
  "settings.get": SettingsResultSchema,
  "settings.set": SettingsResultSchema,
  "usage.export": UsageExportResultSchema,
} as const;
