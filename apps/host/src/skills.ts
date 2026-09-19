import { getAgentDir, loadSkills } from "@earendil-works/pi-coding-agent";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type SkillInfo = {
  name: string;
  description: string;
  filePath: string;
  source: string;
  disableModelInvocation?: boolean;
};

const SKILL_NAME = /^[a-z0-9][a-z0-9-]*$/;

export function listSkills(cwd?: string | null): SkillInfo[] {
  const result = loadSkills({
    cwd: cwd?.trim() || process.cwd(),
    agentDir: getAgentDir(),
    skillPaths: [],
    includeDefaults: true,
  });
  return result.skills.map((skill) => ({
    name: skill.name,
    description: skill.description,
    filePath: skill.filePath,
    source: skillSource(skill.sourceInfo),
    disableModelInvocation: skill.disableModelInvocation,
  }));
}

export async function createSkill(input: {
  name: string;
  description: string;
  body?: string;
  scope: "user" | "project";
  cwd?: string | null;
}): Promise<SkillInfo> {
  const name = input.name.trim().toLowerCase();
  if (!SKILL_NAME.test(name)) {
    throw new Error("名称只能用小写字母、数字和连字符，例如 review-diff");
  }
  const description = input.description.trim();
  if (!description) {
    throw new Error("请填写一句话说明，Agent 靠它决定要不要用这个 Skill");
  }
  if (input.scope === "project" && !input.cwd?.trim()) {
    throw new Error("请先打开工作区，再创建项目 Skill");
  }
  const existing = listSkills(input.cwd).find((item) => item.name.toLowerCase() === name);
  if (existing) {
    throw new Error(`已有同名 skill：${existing.name}（${existing.filePath}）`);
  }
  const root =
    input.scope === "project"
      ? join(input.cwd!.trim(), ".pi", "skills", name)
      : join(getAgentDir(), "skills", name);
  const filePath = join(root, "SKILL.md");
  const body = (input.body?.trim() || "按 description 执行。需要时先读相关文件，再给出可执行的下一步。").trim();
  const content = `---
name: ${name}
description: ${description.replace(/\s+/g, " ")}
---

${body}
`;
  await mkdir(root, { recursive: true });
  await writeFile(filePath, content, "utf8");
  return {
    name,
    description,
    filePath,
    source: input.scope,
  };
}

export async function expandSkillPrompt(text: string, cwd?: string | null): Promise<string> {
  const match = text.match(/^\/skill:([a-z0-9-]+)(?:\s+([\s\S]+))?$/i);
  if (!match) {
    return text;
  }
  const name = match[1]!.toLowerCase();
  const rest = match[2]?.trim();
  const skill = listSkills(cwd).find((item) => item.name.toLowerCase() === name);
  if (!skill) {
    throw new Error(`找不到 skill：${name}`);
  }
  let content = "";
  try {
    content = await readFile(skill.filePath, "utf8");
  } catch {
    throw new Error(`无法读取 skill 文件：${skill.name}`);
  }
  const body = content.replace(/^---[\s\S]*?---\s*/, "").trim();
  const skillBlock = `<skill name="${escapeAttr(skill.name)}" location="${escapeAttr(skill.filePath)}">\n${body}\n</skill>`;
  return rest ? `${skillBlock}\n\n${rest}` : skillBlock;
}

function skillSource(info: { source?: string; scope?: string } | undefined): string {
  if (info?.scope === "project") {
    return "project";
  }
  if (info?.scope === "user") {
    return "user";
  }
  return info?.source ?? "user";
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
