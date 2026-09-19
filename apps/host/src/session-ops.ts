import { unlink } from "node:fs/promises";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import type { SessionSummary } from "@anvil/protocol";
import { toSessionSummary } from "./sdk-map.ts";

export async function listWorkspaceSessions(cwd: string): Promise<SessionSummary[]> {
  const listed = await SessionManager.list(cwd);
  return listed.map(toSessionSummary).sort((a, b) => b.mtime - a.mtime);
}

export function renameSessionFile(file: string, title: string): SessionSummary {
  const name = title.trim();
  if (!name) {
    throw new Error("标题不能为空");
  }
  const manager = SessionManager.open(file);
  manager.appendSessionInfo(name);
  return {
    id: manager.getSessionFile() ?? file,
    title: manager.getSessionName() ?? name,
    mtime: Date.now(),
  };
}

export async function deleteSessionFile(file: string): Promise<void> {
  if (!file.endsWith(".jsonl")) {
    throw new Error("只能删除 Pi jsonl 会话文件");
  }
  await unlink(file);
}


