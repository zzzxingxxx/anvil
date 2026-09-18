import { SessionManager } from "@earendil-works/pi-coding-agent";

const EMPTY_USAGE = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

type PersistInput = {
  cwd: string;
  sessionDir?: string;
  parentSession?: string;
  title: string;
  userText: string;
  assistantText: string;
};

/**
 * Pi only flushes jsonl after an assistant message exists.
 * Anvil therefore always writes a user + assistant pair so official `pi` can resume.
 */
export function persistPiSession(input: PersistInput): string {
  const manager = SessionManager.create(input.cwd, input.sessionDir, {
    parentSession: input.parentSession,
  });
  manager.appendSessionInfo(input.title);
  manager.appendMessage({
    role: "user",
    content: input.userText,
    timestamp: Date.now(),
  });
  manager.appendMessage({
    role: "assistant",
    content: [{ type: "text", text: input.assistantText }],
    api: "openai-completions",
    provider: "anvil",
    model: "host-orchestrator",
    usage: EMPTY_USAGE,
    stopReason: "stop",
    timestamp: Date.now(),
  });
  const file = manager.getSessionFile();
  if (!file) {
    throw new Error("未写出 Pi jsonl");
  }
  return file;
}

export function appendPiUser(file: string, text: string): void {
  const manager = SessionManager.open(file);
  manager.appendMessage({
    role: "user",
    content: text,
    timestamp: Date.now(),
  });
}

export function appendPiAssistant(file: string, text: string): void {
  const manager = SessionManager.open(file);
  manager.appendMessage({
    role: "assistant",
    content: [{ type: "text", text }],
    api: "openai-completions",
    provider: "anvil",
    model: "host-orchestrator",
    usage: EMPTY_USAGE,
    stopReason: "stop",
    timestamp: Date.now(),
  });
}

export function hydrateUiFromPi(file: string): {
  title: string;
  messages: Array<{ id: string; role: "user" | "assistant" | "system"; text: string; createdAt: number }>;
} {
  const opened = SessionManager.open(file);
  const title = opened.getSessionName() ?? "已恢复";
  const messages: Array<{ id: string; role: "user" | "assistant" | "system"; text: string; createdAt: number }> = [];
  for (const entry of opened.getEntries()) {
    if (entry.type !== "message") continue;
    const message = entry.message as { role?: string; content?: unknown; timestamp?: number };
    const role = message.role === "assistant" ? "assistant" : message.role === "user" ? "user" : null;
    if (!role) continue;
    const text =
      typeof message.content === "string"
        ? message.content
        : Array.isArray(message.content)
          ? message.content
              .map((part) => (part && typeof part === "object" && "text" in part ? String(part.text) : ""))
              .join("")
          : "";
    messages.push({
      id: entry.id,
      role,
      text,
      createdAt: typeof message.timestamp === "number" ? message.timestamp : Date.parse(entry.timestamp),
    });
  }
  return { title, messages };
}
