import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ArtifactStore, snapshotMarker, unifiedDiff } from "./store.ts";

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

  it("stores a hash marker instead of oversized content", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "anvil-art-big-"));
    const store = new ArtifactStore(cwd);
    const huge = "x".repeat(64);
    const record = await store.snapshotWrite("blob.bin", huge, 16);
    expect(record.after).toContain("skipped");
    expect(record.after).toContain("sha256:");
    expect(record.after?.length ?? 0).toBeLessThan(80);
    expect(snapshotMarker(12, "abcd").startsWith("<skipped")).toBe(true);
  });
});
