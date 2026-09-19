import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createSkill, expandSkillPrompt, listSkills } from "./skills.ts";

describe("skills", () => {
  const previousPiDir = process.env.PI_CODING_AGENT_DIR;

  afterEach(() => {
    if (previousPiDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = previousPiDir;
    }
  });

  it("lists project skills and expands /skill:name", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "anvil-skill-"));
    const skillDir = join(cwd, ".pi", "skills", "review-diff");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, "SKILL.md"),
      `---
name: review-diff
description: Review the current diff carefully.
---
Look at git diff and list risks.
`,
      "utf8",
    );
    process.env.PI_CODING_AGENT_DIR = join(cwd, "agent-home");
    const listed = listSkills(cwd);
    expect(listed.some((item) => item.name === "review-diff")).toBe(true);
    const expanded = await expandSkillPrompt("/skill:review-diff 看这次改动", cwd);
    expect(expanded).toContain('<skill name="review-diff"');
    expect(expanded).toContain("Look at git diff and list risks.");
    expect(expanded).toContain("看这次改动");
  });

  it("rejects unknown skill names", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "anvil-skill-miss-"));
    await expect(expandSkillPrompt("/skill:missing", cwd)).rejects.toThrow(/找不到 skill/);
  });

  it("creates a project SKILL.md that loadSkills can find", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "anvil-skill-create-"));
    process.env.PI_CODING_AGENT_DIR = join(cwd, "agent-home");
    const created = await createSkill({
      name: "write-pr",
      description: "按仓库规范写 PR 说明",
      body: "先看 git diff，再写标题和要点。",
      scope: "project",
      cwd,
    });
    expect(created.filePath).toContain(join(".pi", "skills", "write-pr", "SKILL.md"));
    const disk = await readFile(created.filePath, "utf8");
    expect(disk).toContain("name: write-pr");
    expect(listSkills(cwd).some((item) => item.name === "write-pr")).toBe(true);
  });
});
