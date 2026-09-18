import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { ArtifactStore } from "@anvil/pi-ext-artifact";
import type { AnvilEvent } from "@anvil/protocol";
import { ApprovalQueue } from "./approvals.ts";
import { FakePiAdapter } from "./fake-pi-adapter.ts";
import { createWorkspaceState } from "./state.ts";

describe("FakePiAdapter", () => {
  it("emits a prompt loop that ends idle", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "anvil-fake-art-"));
    const state = createWorkspaceState();
    state.cwd = cwd;
    state.trust = "trusted";
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    const events: AnvilEvent["type"][] = [];
    adapter.subscribe((event) => {
      events.push(event.type);
      if (event.type === "approval/needed") {
        approvals.respond(event.request.requestId, "allow-once");
      }
    });
    await adapter.prompt({ text: "你好" });
    expect(events[0]).toBe("agent/running");
    expect(events).toContain("message/upsert");
    expect(events).toContain("tool/start");
    expect(events).toContain("approval/needed");
    expect(events).toContain("tool/end");
    expect(events.at(-1)).toBe("agent/idle");
    expect(state.messages.some((message) => message.role === "user")).toBe(true);
    expect(state.tools[0]?.name).toBe("bash");
    expect(state.tools[0]?.status).toBe("success");
    expect(state.tree).toBeTruthy();
    expect(state.changes.some((change) => change.path === ".anvil/demo-diff.txt")).toBe(true);
    const items = await new ArtifactStore(cwd).list();
    expect(items.some((item) => item.path.includes("demo-diff.txt"))).toBe(true);
  });

  it("navigates and forks without mixing later messages", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "anvil-fake-fork-"));
    const state = createWorkspaceState();
    state.cwd = cwd;
    state.trust = "untrusted";
    const adapter = new FakePiAdapter(state);
    await adapter.prompt({ text: "第一句" });
    const firstAssistant = state.messages.find((item) => item.role === "assistant")?.id;
    await adapter.prompt({ text: "第二句" });
    expect(state.messages.filter((item) => item.role === "user")).toHaveLength(2);
    if (firstAssistant) {
      await adapter.navigate(firstAssistant);
      expect(state.currentEntryId).toBe(firstAssistant);
      const forked = await adapter.fork(firstAssistant);
      expect(forked.id.endsWith(".jsonl")).toBe(true);
      expect(state.messages.some((item) => item.text === "第二句")).toBe(false);
    }
  });

  it("asks for bash outside the allowlist even when trusted", async () => {
    const state = createWorkspaceState();
    state.trust = "trusted";
    state.settings = { bashPolicy: "allowlist", bashAllowlist: ["git log"] };
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    const events: AnvilEvent["type"][] = [];
    adapter.subscribe((event) => {
      events.push(event.type);
      if (event.type === "approval/needed") {
        approvals.respond(event.request.requestId, "deny");
      }
    });
    await adapter.prompt({ text: "git status" });
    expect(events).toContain("approval/needed");
    expect(state.tools[0]?.status).toBe("error");
  });

  it("denies bash in untrusted workspaces", async () => {
    const state = createWorkspaceState();
    state.trust = "untrusted";
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    await adapter.prompt({ text: "列出文件" });
    expect(state.tools[0]?.status).toBe("error");
    expect(state.tools[0]?.output).toMatch(/未信任/);
  });

  it("writes a Pi jsonl that SessionManager can reopen", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "anvil-fake-sess-"));
    const state = createWorkspaceState();
    state.cwd = cwd;
    const adapter = new FakePiAdapter(state);
    const session = await adapter.newSession("假循环落盘");
    expect(session.id.endsWith(".jsonl")).toBe(true);
    const opened = SessionManager.open(session.id);
    expect(opened.getHeader()?.type).toBe("session");
    expect(opened.getEntries().length).toBeGreaterThan(0);
    const resumed = await adapter.resumeSession(session.id);
    expect(resumed.id).toBe(session.id);
  });

  it("hydrates messages from a persisted jsonl on resume", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "anvil-fake-resume-"));
    const state = createWorkspaceState();
    state.cwd = cwd;
    state.trust = "untrusted";
    const adapter = new FakePiAdapter(state);
    await adapter.prompt({ text: "解释这个仓库" });
    expect(state.sessionId?.endsWith(".jsonl")).toBe(true);
    const file = state.sessionId!;
    const opened = SessionManager.open(file);
    expect(opened.getEntries().some((entry) => entry.type === "message")).toBe(true);
    const other = createWorkspaceState();
    other.cwd = cwd;
    const restorer = new FakePiAdapter(other);
    await restorer.resumeSession(file);
    expect(other.messages.some((item) => item.text.includes("解释这个仓库"))).toBe(true);
  });
});
