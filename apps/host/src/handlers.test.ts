import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeRequest } from "@anvil/protocol";
import { ApprovalQueue } from "./approvals.ts";
import { FakePiAdapter } from "./fake-pi-adapter.ts";
import { handleRequest } from "./handlers.ts";
import { createWorkspaceState } from "./state.ts";

describe("handleRequest", () => {
  const previousHome = process.env.ANVIL_HOME;

  beforeEach(async () => {
    process.env.ANVIL_HOME = await mkdtemp(join(tmpdir(), "anvil-home-"));
  });

  afterEach(() => {
    if (previousHome === undefined) {
      delete process.env.ANVIL_HOME;
    } else {
      process.env.ANVIL_HOME = previousHome;
    }
  });

  it("rejects unknown commands", async () => {
    const state = createWorkspaceState();
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    const response = await handleRequest(makeRequest("nope", {}, "x"), state, adapter, approvals);
    expect(response.kind).toBe("res");
    expect(response.payload).toMatchObject({ ok: false, code: "unknown_command" });
  });

  it("accepts agent.prompt", async () => {
    const state = createWorkspaceState();
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    const response = await handleRequest(
      makeRequest("agent.prompt", { text: "你好" }, "p1"),
      state,
      adapter,
      approvals,
    );
    expect(response.payload).toMatchObject({ ok: true });
    await adapter.abort();
  });

  it("opens a real directory as untrusted workspace", async () => {
    const dir = await mkdtemp(join(tmpdir(), "anvil-ws-"));
    await writeFile(join(dir, "README.md"), "# hi\n", "utf8");
    const state = createWorkspaceState();
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    const response = await handleRequest(
      makeRequest("workspace.open", { path: dir }, "w1"),
      state,
      adapter,
      approvals,
    );
    expect(response.payload).toMatchObject({ ok: true, trust: "untrusted" });
    expect(state.cwd).toBeTruthy();

    const tree = await handleRequest(
      makeRequest("fs.tree", {}, "t1"),
      state,
      adapter,
      approvals,
    );
    expect(tree.payload).toMatchObject({ ok: true });
    const entries = (tree.payload as { entries: Array<{ name: string }> }).entries;
    expect(entries.some((entry) => entry.name === "README.md")).toBe(true);
  });
});
