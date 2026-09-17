import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { searchFiles } from "./search.ts";

describe("searchFiles", () => {
  it("finds a markdown file by partial name", async () => {
    const dir = await mkdtemp(join(tmpdir(), "anvil-search-"));
    await mkdir(join(dir, "docs"));
    await writeFile(join(dir, "docs", "开发计划.md"), "# plan\n", "utf8");
    const hits = await searchFiles(dir, "开发计划");
    expect(hits.some((hit) => hit.name.includes("开发计划"))).toBe(true);
  });
});
