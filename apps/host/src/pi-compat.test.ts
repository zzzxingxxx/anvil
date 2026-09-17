import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { persistPiSession } from "./session-persist.ts";

describe("Pi session compatibility", () => {
  it("round-trips five Anvil-created jsonl files through SessionManager", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "anvil-pi-"));
    const sessionDir = join(cwd, "sessions");
    const files: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const file = persistPiSession({
        cwd,
        sessionDir,
        title: `Anvil 兼容抽检 ${i + 1}`,
        userText: `用 Anvil 产生的会话 ${i + 1}，官方 pi 应能打开。`,
        assistantText: "已落盘。SessionManager.open 与 pi --session 都能读。",
      });
      files.push(file);
    }
    expect(new Set(files).size).toBe(5);
    for (const file of files) {
      const opened = SessionManager.open(file);
      expect(opened.getHeader()?.type).toBe("session");
      expect(opened.getSessionFile()).toBe(file);
      expect(opened.getEntries().length).toBeGreaterThan(0);
    }
  });
});
