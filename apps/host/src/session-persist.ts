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
