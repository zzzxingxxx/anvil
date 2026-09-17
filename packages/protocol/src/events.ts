import { z } from "zod";
import { AgentStatusSchema, TrustLevelSchema } from "./commands.ts";

export const UsageSchema = z.object({
  inputTokens: z.number(),
  outputTokens: z.number(),
  cacheReadTokens: z.number().optional(),
  cacheWriteTokens: z.number().optional(),
  costUsd: z.number().optional(),
});
export type Usage = z.infer<typeof UsageSchema>;

export const MessageRoleSchema = z.enum(["user", "assistant", "system"]);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const UiMessageSchema = z.object({
  id: z.string(),
  role: MessageRoleSchema,
  text: z.string(),
  createdAt: z.number(),
  streaming: z.boolean().optional(),
});
export type UiMessage = z.infer<typeof UiMessageSchema>;

export const ToolStatusSchema = z.enum(["queued", "running", "success", "error"]);
export type ToolStatus = z.infer<typeof ToolStatusSchema>;

export const ApprovalRequestSchema = z.object({
  requestId: z.string(),
  toolName: z.string(),
  argsPreview: z.string(),
  risk: z.enum(["low", "medium", "high"]),
});
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

export const TreeNodeSchema: z.ZodType<TreeNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    parentId: z.string().nullable(),
    summary: z.string(),
    status: z.enum(["ok", "error", "compressed"]),
    children: z.array(TreeNodeSchema),
  }),
);
export type TreeNode = {
  id: string;
  parentId: string | null;
  summary: string;
  status: "ok" | "error" | "compressed";
  children: TreeNode[];
};

export const SessionReplacedEventSchema = z.object({
  type: z.literal("session/replaced"),
  sessionId: z.string(),
  title: z.string(),
});

export const MessageUpsertEventSchema = z.object({
  type: z.literal("message/upsert"),
  message: UiMessageSchema,
});

export const ToolStartEventSchema = z.object({
  type: z.literal("tool/start"),
  callId: z.string(),
  name: z.string(),
  args: z.unknown(),
});

export const ToolUpdateEventSchema = z.object({
  type: z.literal("tool/update"),
  callId: z.string(),
  partial: z.string(),
});

export const ToolEndEventSchema = z.object({
  type: z.literal("tool/end"),
  callId: z.string(),
  ok: z.boolean(),
  result: z.unknown(),
});

export const ApprovalNeededEventSchema = z.object({
  type: z.literal("approval/needed"),
  request: ApprovalRequestSchema,
});

export const UsageUpdateEventSchema = z.object({
  type: z.literal("usage/update"),
  tokens: UsageSchema,
});

export const TreeChangedEventSchema = z.object({
  type: z.literal("tree/changed"),
  root: TreeNodeSchema,
});

export const FsChangedEventSchema = z.object({
  type: z.literal("fs/changed"),
  paths: z.array(z.string()),
});

export const AgentRunningEventSchema = z.object({
  type: z.literal("agent/running"),
});

export const AgentIdleEventSchema = z.object({
  type: z.literal("agent/idle"),
});

export const AgentErrorEventSchema = z.object({
  type: z.literal("agent/error"),
  error: z.string().optional(),
});

export const HeartbeatEventSchema = z.object({
  type: z.literal("heartbeat"),
  ts: z.number(),
});

export const SnapshotEventSchema = z.object({
  type: z.literal("snapshot"),
  cwd: z.string().nullable(),
  trust: TrustLevelSchema,
  sessionId: z.string().nullable(),
  sessionTitle: z.string().nullable(),
  modelId: z.string().nullable(),
  modelLabel: z.string().nullable(),
  agentStatus: AgentStatusSchema,
  messages: z.array(UiMessageSchema),
  tools: z.array(
    z.object({
      callId: z.string(),
      name: z.string(),
      args: z.unknown(),
      status: ToolStatusSchema,
      output: z.string(),
    }),
  ),
  usage: UsageSchema,
  sessions: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      mtime: z.number(),
      tokens: z.number().optional(),
    }),
  ).optional(),
  models: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        provider: z.string(),
      }),
    )
    .optional(),
  recentWorkspaces: z.array(z.string()).optional(),
  pendingApproval: ApprovalRequestSchema.nullable().optional(),
  adapter: z.enum(["fake", "sdk"]).optional(),
});

export const AnvilEventSchema = z.discriminatedUnion("type", [
  SessionReplacedEventSchema,
  MessageUpsertEventSchema,
  ToolStartEventSchema,
  ToolUpdateEventSchema,
  ToolEndEventSchema,
  ApprovalNeededEventSchema,
  UsageUpdateEventSchema,
  TreeChangedEventSchema,
  FsChangedEventSchema,
  AgentRunningEventSchema,
  AgentIdleEventSchema,
  AgentErrorEventSchema,
  HeartbeatEventSchema,
  SnapshotEventSchema,
]);
export type AnvilEvent = z.infer<typeof AnvilEventSchema>;
