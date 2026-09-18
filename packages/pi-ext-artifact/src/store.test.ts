import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ArtifactStore, unifiedDiff } from "./store.ts";

describe("unifiedDiff", () => {
  it("marks added and removed lines", () => {
    const diff = unifiedDiff("a.ts", "hello\nworld", "hello\nthere");
    expect(diff).toContain("-world");
    expect(diff).toContain("+there");
    expect(diff).toContain(" hello");
  });

  it("lists snapshot files after a write", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "anvil-art-"));
    const store = new ArtifactStore(cwd);
    await store.snapshotWrite("notes.md", "hello");
    const items = await store.list();
    expect(items.some((item) => item.path.endsWith("notes.md.after"))).toBe(true);
  });
});
