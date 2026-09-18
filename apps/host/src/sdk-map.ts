import type { AnvilEvent, ModelInfo, SessionSummary, UiMessage, Usage } from "@anvil/protocol";

type LooseMessage = {
  role?: string;
  content?: unknown;
  text?: string;
  id?: string;
  timestamp?: number | string;
  usage?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    cost?: { total?: number } | number;
  };
};

export function modelKey(provider: string, id: string): string {
  return `${provider}/${id}`;
}

export function parseModelKey(key: string): { provider: string; id: string } {
  const slash = key.indexOf("/");
  if (slash <= 0) {
    return { provider: "unknown", id: key };
  }
  return { provider: key.slice(0, slash), id: key.slice(slash + 1) };
}

export function toModelInfo(model: { id?: string; name?: string; provider?: string }): ModelInfo {
  const provider = model.provider ?? "unknown";
  const id = model.id ?? "unknown";
  return {
    id: modelKey(provider, id),
    label: model.name ?? id,
    provider,
  };
}

export function latestSession(sessions: SessionSummary[]): SessionSummary | undefined {
  return [...sessions].sort((a, b) => b.mtime - a.mtime)[0];
}

export function toSessionSummary(info: {
  path: string;
  id: string;
  name?: string;
  modified: Date;
  firstMessage: string;
  messageCount: number;
}): SessionSummary {
  const title = info.name?.trim() || firstLine(info.firstMessage) || `会话 ${info.id.slice(0, 8)}`;
  return {
    id: info.path,
    title,
    mtime: info.modified.getTime(),
    tokens: info.messageCount,
  };
}

export function messageText(message: unknown): string {
  const value = message as LooseMessage;
  if (typeof value?.text === "string" && value.text.trim()) {
    return value.text;
  }
  return extractContent(value?.content);
}

export function toUiMessage(message: unknown, streaming = false, entryId?: string): UiMessage | null {
  const value = message as LooseMessage;
  const role = normalizeRole(value?.role);
  if (!role) {
    return null;
  }
  const text = messageText(value);
  const id =
    entryId ||
    (typeof value?.id === "string" && value.id
      ? value.id
      : `${role}-${hashish(text)}-${String(value?.timestamp ?? "")}`);
  const createdAt = toEpoch(value?.timestamp);
  return { id, role, text, createdAt, streaming: streaming || undefined };
}

export function usageFromSessionStats(stats: {
  tokens?: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number };
  cost?: number;
}): Usage {
  return {
    inputTokens: stats.tokens?.input ?? 0,
    outputTokens: stats.tokens?.output ?? 0,
    cacheReadTokens: stats.tokens?.cacheRead ?? 0,
    cacheWriteTokens: stats.tokens?.cacheWrite ?? 0,
    costUsd: stats.cost ?? 0,
  };
}

export function usageFromMessage(message: unknown, previous: Usage): Usage | null {
  const usage = (message as LooseMessage)?.usage;
  if (!usage) {
    return null;
  }
  const cost =
    typeof usage.cost === "number"
      ? usage.cost
      : typeof usage.cost === "object"
        ? usage.cost.total
        : undefined;
  return {
    inputTokens: previous.inputTokens + (usage.input ?? 0),
    outputTokens: previous.outputTokens + (usage.output ?? 0),
    cacheReadTokens: (previous.cacheReadTokens ?? 0) + (usage.cacheRead ?? 0),
    cacheWriteTokens: (previous.cacheWriteTokens ?? 0) + (usage.cacheWrite ?? 0),
    costUsd: (previous.costUsd ?? 0) + (cost ?? 0),
  };
}

export function stringifyPartial(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object") {
    if ("text" in value && typeof (value as { text: unknown }).text === "string") {
      return (value as { text: string }).text;
    }
    if ("output" in value && typeof (value as { output: unknown }).output === "string") {
      return (value as { output: string }).output;
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return value == null ? "" : String(value);
}

export function eventFromSdk(event: { type: string } & Record<string, unknown>): AnvilEvent | null {
  switch (event.type) {
    case "agent_start":
      return { type: "agent/running" };
    case "agent_end":
    case "agent_settled":
      return { type: "agent/idle" };
    default:
      return null;
  }
}

function normalizeRole(role: unknown): UiMessage["role"] | null {
  if (role === "user" || role === "assistant" || role === "system") {
    return role;
  }
  return null;
}

function extractContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") {
      continue;
    }
    const typed = block as { type?: string; text?: string };
    if (typed.type === "text" && typeof typed.text === "string") {
      parts.push(typed.text);
    }
  }
  return parts.join("");
}

function firstLine(text: string): string {
  return text.split(/\r?\n/).find((line) => line.trim())?.trim().slice(0, 48) ?? "";
}

function toEpoch(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 10_000_000_000 ? value * 1000 : value;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return Date.now();
}

function hashish(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16);
}
