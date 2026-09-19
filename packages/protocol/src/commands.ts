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
  model: z.string().optional(),
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

export const WorkspacePickFolderPayloadSchema = z.object({
  defaultPath: z.string().optional(),
});
export type WorkspacePickFolderPayload = z.infer<typeof WorkspacePickFolderPayloadSchema>;

export const WorkspacePickFolderResultSchema = z.object({
  ok: z.literal(true),
  path: z.string().nullable(),
});
export type WorkspacePickFolderResult = z.infer<typeof WorkspacePickFolderResultSchema>;

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
  preview: z.string().optional(),
  createdAt: z.number().optional(),
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

export const SessionRenamePayloadSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(80),
});
export type SessionRenamePayload = z.infer<typeof SessionRenamePayloadSchema>;

export const SessionRenameResultSchema = SessionNewResultSchema;
export type SessionRenameResult = z.infer<typeof SessionRenameResultSchema>;

export const SessionDeletePayloadSchema = z.object({
  id: z.string().min(1),
});
export type SessionDeletePayload = z.infer<typeof SessionDeletePayloadSchema>;

export const SessionDeleteResultSchema = z.object({
  ok: z.literal(true),
  deletedId: z.string(),
  currentId: z.string().nullable(),
});
export type SessionDeleteResult = z.infer<typeof SessionDeleteResultSchema>;

export const McpServerConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  enabled: z.boolean().optional(),
});
export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;

export const McpToolInfoSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});
export type McpToolInfo = z.infer<typeof McpToolInfoSchema>;

export const McpServerStatusSchema = z.object({
  id: z.string(),
  name: z.string(),
  command: z.string(),
  args: z.array(z.string()).optional(),
  enabled: z.boolean(),
  status: z.enum(["connected", "disabled", "error", "connecting"]),
  error: z.string().optional(),
  tools: z.array(McpToolInfoSchema),
});
export type McpServerStatus = z.infer<typeof McpServerStatusSchema>;

export const McpListPayloadSchema = z.object({}).strict();
export const McpListResultSchema = z.object({
  ok: z.literal(true),
  servers: z.array(McpServerStatusSchema),
});
export type McpListResult = z.infer<typeof McpListResultSchema>;

export const McpSetPayloadSchema = z.object({
  servers: z.array(McpServerConfigSchema),
});
export type McpSetPayload = z.infer<typeof McpSetPayloadSchema>;

export const McpSetResultSchema = McpListResultSchema;
export type McpSetResult = z.infer<typeof McpSetResultSchema>;

export const McpAddPayloadSchema = z.object({
  text: z.string().min(1).max(500),
});
export type McpAddPayload = z.infer<typeof McpAddPayloadSchema>;
export const McpAddResultSchema = z.object({
  ok: z.literal(true),
  added: McpServerStatusSchema,
  servers: z.array(McpServerStatusSchema),
});
export type McpAddResult = z.infer<typeof McpAddResultSchema>;

export const SkillInfoSchema = z.object({
  name: z.string(),
  description: z.string(),
  filePath: z.string(),
  source: z.string(),
  disableModelInvocation: z.boolean().optional(),
});
export type SkillInfo = z.infer<typeof SkillInfoSchema>;

export const SkillListPayloadSchema = z.object({}).strict();
export const SkillListResultSchema = z.object({
  ok: z.literal(true),
  skills: z.array(SkillInfoSchema),
});
export type SkillListResult = z.infer<typeof SkillListResultSchema>;

export const SkillCreatePayloadSchema = z.object({
  prompt: z.string().min(1).max(2000).optional(),
  name: z
    .string()
    .min(1)
    .max(48)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "名称只能用小写字母、数字和连字符")
    .optional(),
  description: z.string().min(1).max(200).optional(),
  body: z.string().max(20_000).optional(),
  scope: z.enum(["user", "project"]).default("project"),
});
export type SkillCreatePayload = z.infer<typeof SkillCreatePayloadSchema>;

export const SkillCreateResultSchema = z.object({
  ok: z.literal(true),
  skill: SkillInfoSchema,
  skills: z.array(SkillInfoSchema),
});
export type SkillCreateResult = z.infer<typeof SkillCreateResultSchema>;

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

export const ModelEndpointSchema = z.object({
  id: z.string(),
  baseUrl: z.string(),
  modelCount: z.number(),
});
export type ModelEndpoint = z.infer<typeof ModelEndpointSchema>;

export const ModelImportPayloadSchema = z.object({
  url: z.string().min(1),
  apiKey: z.string().min(1),
  provider: z.string().min(1).optional(),
});
export type ModelImportPayload = z.infer<typeof ModelImportPayloadSchema>;

export const ModelImportResultSchema = z.object({
  ok: z.literal(true),
  provider: z.string(),
  imported: z.number(),
  models: z.array(ModelInfoSchema),
  endpoints: z.array(ModelEndpointSchema).optional(),
});
export type ModelImportResult = z.infer<typeof ModelImportResultSchema>;

export const ModelProvidersPayloadSchema = z.object({}).strict();
export const ModelProvidersResultSchema = z.object({
  ok: z.literal(true),
  endpoints: z.array(ModelEndpointSchema),
});
export type ModelProvidersResult = z.infer<typeof ModelProvidersResultSchema>;

export const ModelRemovePayloadSchema = z.object({
  provider: z.string().min(1),
});
export type ModelRemovePayload = z.infer<typeof ModelRemovePayloadSchema>;

export const ModelRemoveResultSchema = z.object({
  ok: z.literal(true),
  provider: z.string(),
  models: z.array(ModelInfoSchema),
  endpoints: z.array(ModelEndpointSchema),
});
export type ModelRemoveResult = z.infer<typeof ModelRemoveResultSchema>;

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
  model: z.string().optional(),
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

export const PersonaModelsSchema = z.object({
  architect: z.string().optional(),
  implementer: z.string().optional(),
  reviewer: z.string().optional(),
});
export type PersonaModels = z.infer<typeof PersonaModelsSchema>;

export const SettingsSchema = z.object({
  trustDefault: TrustLevelSchema.optional(),
  bashPolicy: z.enum(["ask", "allowlist"]).optional(),
  bashAllowlist: z.array(z.string()).optional(),
  defaultModel: z.string().optional(),
  personaModels: PersonaModelsSchema.optional(),
  mcpServers: z.array(McpServerConfigSchema).optional(),
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
  "workspace.pickFolder",
  "workspace.trust",
  "session.list",
  "session.new",
  "session.resume",
  "session.rename",
  "session.delete",
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
  "model.import",
  "model.providers",
  "model.remove",
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
  "mcp.list",
  "mcp.set",
  "mcp.add",
  "skill.list",
  "skill.create",
]);
export type CommandType = z.infer<typeof CommandTypeSchema>;

export const CommandPayloadSchemas = {
  "workspace.open": WorkspaceOpenPayloadSchema,
  "workspace.pickFolder": WorkspacePickFolderPayloadSchema,
  "workspace.trust": WorkspaceTrustPayloadSchema,
  "session.list": SessionListPayloadSchema,
  "session.new": SessionNewPayloadSchema,
  "session.resume": SessionResumePayloadSchema,
  "session.rename": SessionRenamePayloadSchema,
  "session.delete": SessionDeletePayloadSchema,
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
  "model.import": ModelImportPayloadSchema,
  "model.providers": ModelProvidersPayloadSchema,
  "model.remove": ModelRemovePayloadSchema,
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
  "mcp.list": McpListPayloadSchema,
  "mcp.set": McpSetPayloadSchema,
  "mcp.add": McpAddPayloadSchema,
  "skill.list": SkillListPayloadSchema,
  "skill.create": SkillCreatePayloadSchema,
} as const;

export const CommandResultSchemas = {
  "workspace.open": WorkspaceOpenResultSchema,
  "workspace.pickFolder": WorkspacePickFolderResultSchema,
  "workspace.trust": WorkspaceTrustResultSchema,
  "session.list": SessionListResultSchema,
  "session.new": SessionNewResultSchema,
  "session.resume": SessionResumeResultSchema,
  "session.rename": SessionRenameResultSchema,
  "session.delete": SessionDeleteResultSchema,
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
  "model.import": ModelImportResultSchema,
  "model.providers": ModelProvidersResultSchema,
  "model.remove": ModelRemoveResultSchema,
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
  "mcp.list": McpListResultSchema,
  "mcp.set": McpSetResultSchema,
  "mcp.add": McpAddResultSchema,
  "skill.list": SkillListResultSchema,
  "skill.create": SkillCreateResultSchema,
} as const;
