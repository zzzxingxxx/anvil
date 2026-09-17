import { describe, expect, it } from "vitest";
import { createWorkspaceState } from "./state.ts";
import { TaskOrchestrator } from "./tasks.ts";

describe("TaskOrchestrator", () => {
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

  it("completes two read-only children", async () => {
    const state = createWorkspaceState();
    state.cwd = "C:\\repo";
    state.trust = "trusted";
    const tasks = new TaskOrchestrator(state);
    const a = await tasks.delegate({ goal: "拆前端文案", persona: "architect" });
    const b = await tasks.delegate({ goal: "审查改动", persona: "reviewer" });
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(state.tasks.find((item) => item.id === a.id)?.status).toBe("succeeded");
    expect(state.tasks.find((item) => item.id === b.id)?.status).toBe("succeeded");
  });
});
