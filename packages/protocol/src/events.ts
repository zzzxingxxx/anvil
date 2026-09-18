import { z } from "zod";
import { AgentStatusSchema, TaskSummarySchema, TrustLevelSchema } from "./commands.ts";

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
  taskId: z.string().optional(),
  expiresAt: z.number().optional(),
});
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

export const TreeNodeSchema: z.ZodType<TreeNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    parentId: z.string().nullable(),
    summary: z.string(),
    status: z.enum(["ok", "error", "compressed"]),
    current: z.boolean().optional(),
    children: z.array(TreeNodeSchema),
  }),
);
export type TreeNode = {
  id: string;
  parentId: string | null;
  summary: string;
  status: "ok" | "error" | "compressed";
  current?: boolean;
  children: TreeNode[];
};

export const FileChangeSchema = z.object({
  path: z.string(),
  kind: z.enum(["added", "modified", "deleted"]),
  diff: z.string().optional(),
});
export type FileChange = z.infer<typeof FileChangeSchema>;

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
  changes: z.array(FileChangeSchema).optional(),
});

export const AgentRunningEventSchema = z.object({
  type: z.literal("agent/running"),
});

export const AgentIdleEventSchema = z.object({
  type: z.literal("agent/idle"),
  restoredDraft: z.string().optional(),
});

export const AgentErrorEventSchema = z.object({
  type: z.literal("agent/error"),
  error: z.string().optional(),
});

export const TaskUpsertEventSchema = z.object({
  type: z.literal("task/upsert"),
  task: TaskSummarySchema,
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
  adapter: z.enum(["fake", "sdk", "rpc"]).optional(),
  tree: TreeNodeSchema.nullable().optional(),
  changes: z.array(FileChangeSchema).optional(),
  currentEntryId: z.string().nullable().optional(),
  tasks: z.array(TaskSummarySchema).optional(),
  settings: z
    .object({
      trustDefault: TrustLevelSchema.optional(),
      bashPolicy: z.enum(["ask", "allowlist"]).optional(),
      bashAllowlist: z.array(z.string()).optional(),
      defaultModel: z.string().optional(),
    })
    .optional(),
  docker: z
    .object({
      available: z.boolean(),
      version: z.string().optional(),
      reason: z.string().optional(),
    })
    .optional(),
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
  TaskUpsertEventSchema,
  HeartbeatEventSchema,
  SnapshotEventSchema,
]);
export type AnvilEvent = z.infer<typeof AnvilEventSchema>;
