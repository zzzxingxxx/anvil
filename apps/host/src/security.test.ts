import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EnvelopeSchema, makeRequest } from "@anvil/protocol";
import { decideGate } from "@anvil/pi-ext-gate";
import { ApprovalQueue } from "./approvals.ts";
import { FakePiAdapter } from "./fake-pi-adapter.ts";
import { handleRequest } from "./handlers.ts";
import { createWorkspaceState } from "./state.ts";
import { resolveInside } from "./workspace.ts";
import { TaskOrchestrator } from "./tasks.ts";

describe("security regression", () => {
  it("denies untrusted bash/write", () => {
    expect(decideGate({ toolName: "bash", args: { command: "ls" }, trust: "untrusted" }).decision).toBe("deny");
    expect(decideGate({ toolName: "write", args: { path: "a.ts" }, trust: "untrusted" }).decision).toBe("deny");
  });

  it("rejects protected paths", () => {
    expect(
      decideGate({ toolName: "read", args: { path: ".env" }, trust: "trusted" }).decision,
    ).toBe("deny");
  });

  it("rejects path escape from the workspace", async () => {
    const dir = await mkdtemp(join(tmpdir(), "anvil-sec-"));
    expect(() => resolveInside(dir, join(dir, "..", "outside.txt"))).toThrow(/工作区外/);
  });

  it("drops unknown protocol types without throwing", async () => {
    const parsed = EnvelopeSchema.safeParse(makeRequest("nope", {}, "x"));
    expect(parsed.success).toBe(true);
    const state = createWorkspaceState();
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    const response = await handleRequest(makeRequest("nope", {}, "x"), state, adapter, approvals);
    expect(response.payload).toMatchObject({ ok: false, code: "unknown_command" });
  });

  it("keeps child cwd inside the workspace", async () => {
    const dir = await mkdtemp(join(tmpdir(), "anvil-child-"));
    await writeFile(join(dir, "README.md"), "# hi\n", "utf8");
    const state = createWorkspaceState();
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    const tasks = new TaskOrchestrator(state);
    await handleRequest(makeRequest("workspace.open", { path: dir, trust: "trusted" }, "w"), state, adapter, approvals, tasks);
    const response = await handleRequest(
      makeRequest("task.delegate", { goal: "逃逸", persona: "reviewer", cwd: "../secret" }, "d"),
      state,
      adapter,
      approvals,
      tasks,
    );
    expect(response.payload).toMatchObject({ ok: false });
  });
});
