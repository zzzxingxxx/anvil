import { z } from "zod";

export const TrustLevelSchema = z.enum(["untrusted", "trusted"]);
export type TrustLevel = z.infer<typeof TrustLevelSchema>;

export const AgentStatusSchema = z.enum(["idle", "running", "error"]);
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

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

export const CommandTypeSchema = z.enum([
  "workspace.open",
  "workspace.trust",
  "session.list",
  "session.new",
  "session.resume",
  "agent.prompt",
  "agent.steer",
  "agent.followUp",
  "agent.abort",
  "approval.respond",
  "model.list",
  "model.set",
  "fs.tree",
  "fs.read",
]);
export type CommandType = z.infer<typeof CommandTypeSchema>;

export const CommandPayloadSchemas = {
  "workspace.open": WorkspaceOpenPayloadSchema,
  "workspace.trust": WorkspaceTrustPayloadSchema,
  "session.list": SessionListPayloadSchema,
  "session.new": SessionNewPayloadSchema,
  "session.resume": SessionResumePayloadSchema,
  "agent.prompt": AgentPromptPayloadSchema,
  "agent.steer": AgentSteerPayloadSchema,
  "agent.followUp": AgentFollowUpPayloadSchema,
  "agent.abort": AgentAbortPayloadSchema,
  "approval.respond": ApprovalRespondPayloadSchema,
  "model.list": ModelListPayloadSchema,
  "model.set": ModelSetPayloadSchema,
  "fs.tree": FsTreePayloadSchema,
  "fs.read": FsReadPayloadSchema,
} as const;

export const CommandResultSchemas = {
  "workspace.open": WorkspaceOpenResultSchema,
  "workspace.trust": WorkspaceTrustResultSchema,
  "session.list": SessionListResultSchema,
  "session.new": SessionNewResultSchema,
  "session.resume": SessionResumeResultSchema,
  "agent.prompt": AgentOkResultSchema,
  "agent.steer": AgentOkResultSchema,
  "agent.followUp": AgentOkResultSchema,
  "agent.abort": AgentOkResultSchema,
  "approval.respond": AgentOkResultSchema,
  "model.list": ModelListResultSchema,
  "model.set": ModelSetResultSchema,
  "fs.tree": FsTreeResultSchema,
  "fs.read": FsReadResultSchema,
} as const;
