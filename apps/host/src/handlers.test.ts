import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
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
  const previousPiDir = process.env.PI_CODING_AGENT_DIR;

  beforeEach(async () => {
    process.env.ANVIL_HOME = await mkdtemp(join(tmpdir(), "anvil-home-"));
  });

  afterEach(() => {
    if (previousHome === undefined) {
      delete process.env.ANVIL_HOME;
    } else {
      process.env.ANVIL_HOME = previousHome;
    }
    if (previousPiDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = previousPiDir;
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

  it("rejects a second prompt while a turn is running", async () => {
    const state = createWorkspaceState();
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    const first = await handleRequest(
      makeRequest("agent.prompt", { text: "第一轮" }, "p-busy-1"),
      state,
      adapter,
      approvals,
    );
    expect(first.payload).toMatchObject({ ok: true });
    const second = await handleRequest(
      makeRequest("agent.prompt", { text: "第二轮" }, "p-busy-2"),
      state,
      adapter,
      approvals,
    );
    expect(second.payload).toMatchObject({ ok: false });
    expect(String((second.payload as { error?: string }).error)).toMatch(/等当前轮结束/);
    await adapter.abort();
  });

  it("rejects opening another workspace while a turn is running", async () => {
    const dir = await mkdtemp(join(tmpdir(), "anvil-busy-ws-"));
    const state = createWorkspaceState();
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    const prompt = adapter.prompt({ text: "还在跑" });
    const response = await handleRequest(
      makeRequest("workspace.open", { path: dir }, "w-busy"),
      state,
      adapter,
      approvals,
    );
    expect(response.payload).toMatchObject({ ok: false });
    expect(String((response.payload as { error?: string }).error)).toMatch(/等当前轮结束/);
    await adapter.abort();
    await prompt;
  });

  it("rejects changing trust or model while a turn is running", async () => {
    const state = createWorkspaceState();
    state.cwd = process.cwd();
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    const prompt = adapter.prompt({ text: "还在跑" });
    const trust = await handleRequest(
      makeRequest("workspace.trust", { trust: "trusted" }, "trust-busy"),
      state,
      adapter,
      approvals,
    );
    expect(trust.payload).toMatchObject({ ok: false });
    expect(String((trust.payload as { error?: string }).error)).toMatch(/等当前轮结束/);
    const model = await handleRequest(
      makeRequest("model.set", { id: "fake/anvil-echo" }, "model-busy"),
      state,
      adapter,
      approvals,
    );
    expect(model.payload).toMatchObject({ ok: false });
    expect(String((model.payload as { error?: string }).error)).toMatch(/等当前轮结束/);
    const settings = await handleRequest(
      makeRequest("settings.set", { bashPolicy: "allowlist" }, "settings-busy"),
      state,
      adapter,
      approvals,
    );
    expect(settings.payload).toMatchObject({ ok: false });
    expect(String((settings.payload as { error?: string }).error)).toMatch(/等当前轮结束/);
    await adapter.abort();
    await prompt;
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

  it("handles workspace.pickFolder without crashing", async () => {
    const state = createWorkspaceState();
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    const response = await handleRequest(
      makeRequest("workspace.pickFolder", {}, "pick-1"),
      state,
      adapter,
      approvals,
    );
    expect(response.payload).toHaveProperty("ok", true);
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

  it("imports OpenAI-compatible models from a URL and key", async () => {
    const dir = await mkdtemp(join(tmpdir(), "anvil-pi-import-"));
    process.env.PI_CODING_AGENT_DIR = dir;
    const previousFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ data: [{ id: "gemini-flash", name: "Gemini Flash" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;
    const state = createWorkspaceState();
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    try {
      const response = await handleRequest(
        makeRequest("model.import", { url: "https://example.test/v1", apiKey: "sk-test" }, "import-1"),
        state,
        adapter,
        approvals,
      );
      expect(response.payload).toMatchObject({ ok: true, imported: 1, provider: "example-test-v1" });
      expect(state.models.some((item) => item.id === "example-test-v1/gemini-flash")).toBe(true);
      const written = JSON.parse(await readFile(join(dir, "models.json"), "utf8")) as {
        providers: Record<string, { baseUrl?: string }>;
      };
      expect(written.providers["example-test-v1"]?.baseUrl).toBe("https://example.test/v1");
      const selected = await handleRequest(
        makeRequest("model.set", { id: "example-test-v1/gemini-flash" }, "select-1"),
        state,
        adapter,
        approvals,
      );
      expect(selected.payload).toMatchObject({
        ok: true,
        model: { id: "example-test-v1/gemini-flash" },
      });
      expect(state.model?.id).toBe("example-test-v1/gemini-flash");
    } finally {
      globalThis.fetch = previousFetch;
    }
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

  it("renames and deletes sessions from the fake adapter", async () => {
    const dir = await mkdtemp(join(tmpdir(), "anvil-session-ops-"));
    const state = createWorkspaceState();
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    await handleRequest(makeRequest("workspace.open", { path: dir }, "w-sess"), state, adapter, approvals);
    const created = await handleRequest(
      makeRequest("session.new", { title: "旧标题" }, "s-new"),
      state,
      adapter,
      approvals,
    );
    const id = (created.payload as { session: { id: string } }).session.id;
    const renamed = await handleRequest(
      makeRequest("session.rename", { id, title: "新标题" }, "s-ren"),
      state,
      adapter,
      approvals,
    );
    expect(renamed.payload).toMatchObject({ ok: true, session: { title: "新标题" } });
    expect(state.sessionTitle).toBe("新标题");
    const deleted = await handleRequest(
      makeRequest("session.delete", { id }, "s-del"),
      state,
      adapter,
      approvals,
    );
    expect(deleted.payload).toMatchObject({ ok: true, deletedId: id });
    expect(state.sessions.some((item) => item.id === id)).toBe(false);
  });

  it("lists skills from the current workspace", async () => {
    const dir = await mkdtemp(join(tmpdir(), "anvil-skill-list-"));
    await mkdir(join(dir, ".pi", "skills", "demo-skill"), { recursive: true });
    await writeFile(
      join(dir, ".pi", "skills", "demo-skill", "SKILL.md"),
      `---
name: demo-skill
description: Demo skill for Anvil.
---
Do the demo.
`,
      "utf8",
    );
    process.env.PI_CODING_AGENT_DIR = join(dir, "agent-home");
    const state = createWorkspaceState();
    state.cwd = dir;
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    const response = await handleRequest(makeRequest("skill.list", {}, "sk1"), state, adapter, approvals);
    expect(response.payload).toMatchObject({ ok: true });
    const skills = (response.payload as { skills: Array<{ name: string }> }).skills;
    expect(skills.some((item) => item.name === "demo-skill")).toBe(true);
  });

  it("adds an MCP server from a short phrase", async () => {
    const state = createWorkspaceState();
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    const response = await handleRequest(makeRequest("mcp.add", { text: "记忆" }, "mcp-add"), state, adapter, approvals);
    expect(response.payload).toMatchObject({ ok: true, added: { id: "memory", name: "memory" } });
  });

  it("creates a project skill from one sentence", async () => {
    const dir = await mkdtemp(join(tmpdir(), "anvil-skill-prompt-"));
    process.env.PI_CODING_AGENT_DIR = join(dir, "agent-home");
    const state = createWorkspaceState();
    state.cwd = dir;
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    const response = await handleRequest(
      makeRequest("skill.create", { prompt: "审查当前 git diff", scope: "project" }, "sk-prompt"),
      state,
      adapter,
      approvals,
    );
    expect(response.payload).toMatchObject({ ok: true, skill: { name: "review-diff" } });
  });

  it("creates a project skill from the form", async () => {
    const dir = await mkdtemp(join(tmpdir(), "anvil-skill-create-h-"));
    process.env.PI_CODING_AGENT_DIR = join(dir, "agent-home");
    const state = createWorkspaceState();
    state.cwd = dir;
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    const response = await handleRequest(
      makeRequest(
        "skill.create",
        { name: "review-diff", description: "审查当前 diff", body: "先看 git diff。", scope: "project" },
        "sk-create",
      ),
      state,
      adapter,
      approvals,
    );
    expect(response.payload).toMatchObject({ ok: true, skill: { name: "review-diff" } });
    const disk = await readFile(join(dir, ".pi", "skills", "review-diff", "SKILL.md"), "utf8");
    expect(disk).toContain("name: review-diff");
  });

  it("stores MCP env on the host without echoing the secret", async () => {
    const state = createWorkspaceState();
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    await handleRequest(makeRequest("mcp.add", { text: "GitHub" }, "mcp-gh"), state, adapter, approvals);
    const response = await handleRequest(
      makeRequest("mcp.env", { id: "github", env: { GITHUB_TOKEN: "ghp_test_secret" } }, "mcp-env"),
      state,
      adapter,
      approvals,
    );
    expect(JSON.stringify(response.payload)).not.toContain("ghp_test_secret");
    expect(response.payload).toMatchObject({ ok: true });
    expect(state.settings.mcpServers?.find((item) => item.id === "github")?.env?.GITHUB_TOKEN).toBe("ghp_test_secret");
  });

  it("updates and deletes a created skill", async () => {
    const dir = await mkdtemp(join(tmpdir(), "anvil-skill-edit-h-"));
    process.env.PI_CODING_AGENT_DIR = join(dir, "agent-home");
    const state = createWorkspaceState();
    state.cwd = dir;
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    const created = await handleRequest(
      makeRequest("skill.create", { prompt: "审查当前 git diff", scope: "project" }, "sk-edit-c"),
      state,
      adapter,
      approvals,
    );
    const filePath = (created.payload as { skill: { filePath: string } }).skill.filePath;
    const updated = await handleRequest(
      makeRequest("skill.update", { filePath, description: "新说明", body: "新正文" }, "sk-edit-u"),
      state,
      adapter,
      approvals,
    );
    expect(updated.payload).toMatchObject({ ok: true, skill: { description: "新说明" } });
    const deleted = await handleRequest(makeRequest("skill.delete", { filePath }, "sk-edit-d"), state, adapter, approvals);
    expect(deleted.payload).toMatchObject({ ok: true, deletedPath: filePath });
  });

  it("saves persona model assignments", async () => {
    const state = createWorkspaceState();
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    const response = await handleRequest(
      makeRequest(
        "settings.set",
        { personaModels: { architect: "fake/anvil-echo", reviewer: "fake/anvil-echo" } },
        "persona-models",
      ),
      state,
      adapter,
      approvals,
    );
    expect(response.payload).toMatchObject({ ok: true });
    expect(state.settings.personaModels).toEqual({
      architect: "fake/anvil-echo",
      reviewer: "fake/anvil-echo",
    });
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

  it("restores an added file by deleting it", async () => {
    const dir = await mkdtemp(join(tmpdir(), "anvil-restore-add-"));
    const file = join(dir, "fresh.md");
    await writeFile(file, "new\n", "utf8");
    const state = createWorkspaceState();
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    await handleRequest(makeRequest("workspace.open", { path: dir }, "w-add"), state, adapter, approvals);
    state.snapshots["fresh.md"] = { before: null, after: "new\n" };
    state.changes = [{ path: "fresh.md", kind: "added", diff: "+new\n" }];
    const response = await handleRequest(
      makeRequest("artifact.restore", { path: "fresh.md" }, "r-add"),
      state,
      adapter,
      approvals,
    );
    expect(response.payload).toMatchObject({ ok: true, path: "fresh.md" });
    await expect(access(file)).rejects.toThrow();
    expect(state.changes.some((item) => item.path === "fresh.md")).toBe(false);
    expect(state.snapshots["fresh.md"]).toBeUndefined();
  });

  it("restores a deleted file from its before snapshot", async () => {
    const dir = await mkdtemp(join(tmpdir(), "anvil-restore-del-"));
    const nested = join(dir, "docs");
    await mkdir(nested);
    const file = join(nested, "gone.md");
    const state = createWorkspaceState();
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    await handleRequest(makeRequest("workspace.open", { path: dir }, "w-del"), state, adapter, approvals);
    state.snapshots["docs/gone.md"] = { before: "keep\n", after: null };
    state.changes = [{ path: "docs/gone.md", kind: "deleted", diff: "-keep\n" }];
    const response = await handleRequest(
      makeRequest("artifact.restore", { path: "docs/gone.md" }, "r-del"),
      state,
      adapter,
      approvals,
    );
    expect(response.payload).toMatchObject({ ok: true, path: "docs/gone.md" });
    expect(await readFile(file, "utf8")).toBe("keep\n");
    expect(state.changes.some((item) => item.path === "docs/gone.md")).toBe(false);
    expect(state.snapshots["docs/gone.md"]?.after).toBe("keep\n");
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
