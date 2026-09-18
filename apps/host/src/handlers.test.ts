import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ArtifactStore } from "@anvil/pi-ext-artifact";
import { makeRequest } from "@anvil/protocol";
import { ApprovalQueue } from "./approvals.ts";
import { FakePiAdapter } from "./fake-pi-adapter.ts";
import { handleRequest } from "./handlers.ts";
import { createWorkspaceState } from "./state.ts";
import { TaskOrchestrator } from "./tasks.ts";

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

  it("clears leftover tasks when opening another workspace", async () => {
    const first = await mkdtemp(join(tmpdir(), "anvil-ws-a-"));
    const second = await mkdtemp(join(tmpdir(), "anvil-ws-b-"));
    const state = createWorkspaceState();
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    const tasks = new TaskOrchestrator(state);
    await handleRequest(makeRequest("workspace.open", { path: first }, "w-a"), state, adapter, approvals, tasks);
    state.tasks = [
      {
        id: "task-old",
        parentSessionId: "sess-old",
        sessionId: "sess-old.jsonl",
        persona: "reviewer",
        goal: "旧仓库审查",
        status: "succeeded",
        startedAt: Date.now(),
      },
    ];
    state.snapshots["notes.md"] = { before: "a", after: "b" };
    state.usage = { inputTokens: 9, outputTokens: 4, cacheReadTokens: 1, costUsd: 0.01 };
    await handleRequest(makeRequest("workspace.open", { path: second }, "w-b"), state, adapter, approvals, tasks);
    expect(state.tasks).toEqual([]);
    expect(state.snapshots).toEqual({});
    expect(state.usage.inputTokens).toBe(0);
    expect(state.usage.outputTokens).toBe(0);
  });

  it("applies bash allowlist settings to the workspace state", async () => {
    const state = createWorkspaceState();
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    const response = await handleRequest(
      makeRequest(
        "settings.set",
        { bashPolicy: "allowlist", bashAllowlist: ["git status"] },
        "s1",
      ),
      state,
      adapter,
      approvals,
    );
    expect(response.payload).toMatchObject({ ok: true });
    expect(state.settings.bashPolicy).toBe("allowlist");
    expect(state.settings.bashAllowlist).toEqual(["git status"]);
  });

  it("applies defaultModel to the fake adapter", async () => {
    const state = createWorkspaceState();
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    const response = await handleRequest(
      makeRequest("settings.set", { defaultModel: "fake/anvil-echo" }, "s2"),
      state,
      adapter,
      approvals,
    );
    expect(response.payload).toMatchObject({ ok: true });
    expect(state.model?.id).toBe("fake/anvil-echo");
  });

  it("searches files after opening a workspace", async () => {
    const dir = await mkdtemp(join(tmpdir(), "anvil-search-ws-"));
    await writeFile(join(dir, "开发计划.md"), "# plan\n", "utf8");
    const state = createWorkspaceState();
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    await handleRequest(makeRequest("workspace.open", { path: dir }, "w2"), state, adapter, approvals);
    const response = await handleRequest(
      makeRequest("fs.search", { query: "开发计划" }, "s1"),
      state,
      adapter,
      approvals,
    );
    expect(response.payload).toMatchObject({ ok: true });
    const hits = (response.payload as { hits: Array<{ name: string }> }).hits;
    expect(hits.some((hit) => hit.name.includes("开发计划"))).toBe(true);
  });

  it("restores a snapshot and drops that path from Diff", async () => {
    const dir = await mkdtemp(join(tmpdir(), "anvil-restore-ws-"));
    const file = join(dir, "notes.md");
    await writeFile(file, "before\n", "utf8");
    const state = createWorkspaceState();
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    await handleRequest(makeRequest("workspace.open", { path: dir }, "w-restore"), state, adapter, approvals);
    state.snapshots["notes.md"] = { before: "before\n", after: "after\n" };
    state.changes = [{ path: "notes.md", kind: "modified", diff: "-before\n+after\n" }];
    await writeFile(file, "after\n", "utf8");
    const response = await handleRequest(
      makeRequest("artifact.restore", { path: "notes.md" }, "r1"),
      state,
      adapter,
      approvals,
    );
    expect(response.payload).toMatchObject({ ok: true, path: "notes.md" });
    expect(await readFile(file, "utf8")).toBe("before\n");
    expect(state.changes.some((item) => item.path === "notes.md")).toBe(false);
    expect(state.snapshots["notes.md"]?.after).toBe("before\n");
  });

  it("lists artifact snapshots after a fake write", async () => {
    const dir = await mkdtemp(join(tmpdir(), "anvil-art-ws-"));
    const state = createWorkspaceState();
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    await handleRequest(makeRequest("workspace.open", { path: dir }, "w4"), state, adapter, approvals);
    await new ArtifactStore(dir).snapshotWrite("notes.md", "hello");
    const response = await handleRequest(
      makeRequest("artifact.list", {}, "a1"),
      state,
      adapter,
      approvals,
    );
    expect(response.payload).toMatchObject({ ok: true });
    const items = (response.payload as { items: Array<{ path: string }> }).items;
    expect(items.some((item) => item.path.endsWith("notes.md.after"))).toBe(true);
  });

  it("exports a local usage summary", async () => {
    const state = createWorkspaceState();
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    const response = await handleRequest(makeRequest("usage.export", {}, "u1"), state, adapter, approvals);
    expect(response.payload).toMatchObject({ ok: true });
    expect(String((response.payload as { text: string }).text)).toContain("未上传");
  });

  it("applies project .anvil/settings.json when opening a workspace", async () => {
    const dir = await mkdtemp(join(tmpdir(), "anvil-proj-settings-"));
    await mkdir(join(dir, ".anvil"), { recursive: true });
    await writeFile(
      join(dir, ".anvil", "settings.json"),
      `${JSON.stringify({ bashPolicy: "allowlist", bashAllowlist: ["git status"] }, null, 2)}\n`,
      "utf8",
    );
    const state = createWorkspaceState();
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    const response = await handleRequest(
      makeRequest("workspace.open", { path: dir }, "w5"),
      state,
      adapter,
      approvals,
    );
    expect(response.payload).toMatchObject({ ok: true });
    expect(state.settings.bashPolicy).toBe("allowlist");
    expect(state.settings.bashAllowlist).toEqual(["git status"]);

    await handleRequest(
      makeRequest("settings.set", { defaultModel: "fake/anvil-echo" }, "s3"),
      state,
      adapter,
      approvals,
    );
    const written = JSON.parse(await readFile(join(dir, ".anvil", "settings.json"), "utf8")) as {
      defaultModel?: string;
      bashPolicy?: string;
    };
    expect(written.bashPolicy).toBe("allowlist");
    expect(written.defaultModel).toBe("fake/anvil-echo");
  });

  it("rejects writable delegate in untrusted workspace", async () => {
    const dir = await mkdtemp(join(tmpdir(), "anvil-task-"));
    const state = createWorkspaceState();
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    const tasks = new TaskOrchestrator(state);
    await handleRequest(
      makeRequest("workspace.open", { path: dir }, "w3"),
      state,
      adapter,
      approvals,
      tasks,
    );
    const response = await handleRequest(
      makeRequest("task.delegate", { goal: "改文件", persona: "implementer" }, "d1"),
      state,
      adapter,
      approvals,
      tasks,
    );
    expect(response.payload).toMatchObject({ ok: false });
  });
});
