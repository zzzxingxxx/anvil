import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { ApprovalQueue } from "./approvals.ts";
import { createWorkspaceState } from "./state.ts";
import { childAdapterKind, TaskOrchestrator } from "./tasks.ts";

describe("TaskOrchestrator", () => {
  it("spawns SDK children only when the parent is SDK", () => {
    expect(childAdapterKind("sdk")).toBe("sdk");
    expect(childAdapterKind("fake")).toBe("fake");
    expect(childAdapterKind("rpc")).toBe("fake");
  });

  it("rejects writable children in untrusted workspaces", async () => {
    const state = createWorkspaceState();
    state.cwd = "C:\\repo";
    state.trust = "untrusted";
    const tasks = new TaskOrchestrator(state);
    await expect(tasks.delegate({ goal: "改文件", persona: "implementer" })).rejects.toThrow(/未信任/);
  });

  it("rejects nested delegate", async () => {
    const state = createWorkspaceState();
    state.cwd = "C:\\repo";
    state.trust = "trusted";
    const tasks = new TaskOrchestrator(state);
    await expect(
      tasks.delegate({ goal: "再派一层", persona: "reviewer", parentIsChild: true }),
    ).rejects.toThrow(/深度 1/);
  });

  it("locks the same file for a second writer", async () => {
    const state = createWorkspaceState();
    state.cwd = "C:\\repo";
    state.trust = "trusted";
    const tasks = new TaskOrchestrator(state);
    const first = tasks.locks.tryLock("task-a", "docs/dogfood/phase3.md");
    expect(first.ok).toBe(true);
    const second = tasks.locks.tryLock("task-b", "docs/dogfood/phase3.md");
    expect(second.ok).toBe(false);
  });

  it("completes two read-only children as real Pi jsonl", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "anvil-child-sess-"));
    const sessionDir = join(cwd, "sessions");
    const state = createWorkspaceState();
    state.cwd = cwd;
    state.trust = "trusted";
    const tasks = new TaskOrchestrator(state, sessionDir);
    const a = await tasks.delegate({ goal: "拆前端文案", persona: "architect" });
    const b = await tasks.delegate({ goal: "审查改动", persona: "reviewer" });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(state.tasks.find((item) => item.id === a.id)?.status).toBe("succeeded");
    expect(state.tasks.find((item) => item.id === b.id)?.status).toBe("succeeded");
    expect(a.sessionId?.endsWith(".jsonl")).toBe(true);
    const opened = SessionManager.open(a.sessionId!);
    expect(opened.getHeader()?.type).toBe("session");
    expect(opened.getEntries().length).toBeGreaterThan(0);
    expect(b.sessionId).not.toBe(a.sessionId);
    expect(state.messages.some((item) => item.text.includes("只读子任务结束"))).toBe(true);
    expect((state.usage.costUsd ?? 0) > 0).toBe(true);
  });

  it("surfaces child bash approvals on the parent queue", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "anvil-child-appr-"));
    const sessionDir = join(cwd, "sessions");
    const state = createWorkspaceState();
    state.cwd = cwd;
    state.trust = "trusted";
    const approvals = new ApprovalQueue();
    const tasks = new TaskOrchestrator(state, sessionDir, approvals);
    const events: string[] = [];
    tasks.subscribe((event) => {
      events.push(event.type);
      if (event.type === "approval/needed") {
        expect(event.request.taskId).toBeTruthy();
        approvals.respond(event.request.requestId, "deny");
      }
    });
    const task = await tasks.delegate({ goal: "改 notes", persona: "implementer" });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(events).toContain("approval/needed");
    expect(state.tasks.find((item) => item.id === task.id)?.status).toBe("failed");
    expect(state.tasks.find((item) => item.id === task.id)?.error).toMatch(/^用户拒绝/);
  });

  it("fails a child that exceeds maxUsd", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "anvil-child-cost-"));
    const sessionDir = join(cwd, "sessions");
    const state = createWorkspaceState();
    state.cwd = cwd;
    state.trust = "trusted";
    const tasks = new TaskOrchestrator(state, sessionDir);
    const task = await tasks.delegate({ goal: "只读分析", persona: "reviewer", maxUsd: 0 });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(state.tasks.find((item) => item.id === task.id)?.status).toBe("failed");
    expect(state.tasks.find((item) => item.id === task.id)?.error).toMatch(/^超费/);
  });

  it("fails a child that exceeds timeoutSec", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "anvil-child-to-"));
    const sessionDir = join(cwd, "sessions");
    const state = createWorkspaceState();
    state.cwd = cwd;
    state.trust = "trusted";
    const tasks = new TaskOrchestrator(state, sessionDir);
    const task = await tasks.delegate({ goal: "只读分析", persona: "reviewer", timeoutSec: 0.05 });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(state.tasks.find((item) => item.id === task.id)?.status).toBe("failed");
    expect(state.tasks.find((item) => item.id === task.id)?.error).toMatch(/^超时/);
  });
});
