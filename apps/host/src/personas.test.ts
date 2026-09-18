import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePersonas, parsePersonaMarkdown, personasDir } from "./personas.ts";

describe("default personas", () => {
  const previousHome = process.env.ANVIL_HOME;

  beforeEach(async () => {
    process.env.ANVIL_HOME = await mkdtemp(join(tmpdir(), "anvil-personas-"));
  });

  afterEach(() => {
    if (previousHome === undefined) {
      delete process.env.ANVIL_HOME;
    } else {
      process.env.ANVIL_HOME = previousHome;
    }
  });

  it("seeds three markdown files without overwriting edits", async () => {
    const first = await ensurePersonas();
    expect(first.architect.label).toBe("架构师");
    expect(first.reviewer.tools).not.toContain("bash");
    const file = join(personasDir(), "architect.md");
    const original = await readFile(file, "utf8");
    await writeFile(file, original.replace("你是架构师。", "你是本地架构师。"), "utf8");
    const second = await ensurePersonas();
    expect(second.architect.system).toContain("本地架构师");
    expect(parsePersonaMarkdown(original)?.tools).toContain("read");
  });
});
