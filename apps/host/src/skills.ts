import { getAgentDir, loadSkills } from "@earendil-works/pi-coding-agent";
import { readFile } from "node:fs/promises";

export type SkillInfo = {
  name: string;
  description: string;
  filePath: string;
  source: string;
  disableModelInvocation?: boolean;
};

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
