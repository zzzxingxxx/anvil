import { realpath, stat } from "node:fs/promises";
import { isAbsolute, join, normalize, relative, resolve, sep } from "node:path";

const IGNORED = new Set(["node_modules", ".git", "dist", ".anvil", "coverage", ".vite"]);
const TEXT_EXT = new Set([
  ".md",
  ".txt",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
  ".html",
  ".yml",
  ".yaml",
  ".toml",
  ".xml",
  ".svg",
  ".gitignore",
  ".env.example",
]);

export async function resolveWorkspacePath(input: string): Promise<string> {
  const expanded = expandHome(input.trim());
  const absolute = isAbsolute(expanded) ? expanded : resolve(process.cwd(), expanded);
  const stats = await stat(absolute);
  if (!stats.isDirectory()) {
    throw new Error("路径不是目录");
  }
  return await realpath(absolute);
}

export function isInsideWorkspace(cwd: string, candidate: string): boolean {
  const rel = relative(cwd, candidate);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function resolveInside(cwd: string, maybeRelative: string): string {
  const absolute = isAbsolute(maybeRelative) ? normalize(maybeRelative) : resolve(cwd, maybeRelative);
  if (!isInsideWorkspace(cwd, absolute)) {
    throw new Error("禁止访问工作区外的路径");
  }
  return absolute;
}

export function shouldIgnoreName(name: string): boolean {
  return IGNORED.has(name) || name.startsWith(".");
}

export function looksText(path: string): boolean {
  const lower = path.toLowerCase();
  if ([...TEXT_EXT].some((ext) => lower.endsWith(ext))) {
    return true;
  }
  const base = lower.split(/[/\\]/).pop() ?? "";
  return ["license", "readme", "agents.md", "dockerfile"].includes(base);
}

export function joinWorkspace(cwd: string, name: string): string {
  return join(cwd, name);
}

function expandHome(path: string): string {
  if (path === "~") {
    return process.env.USERPROFILE ?? process.env.HOME ?? path;
  }
  if (path.startsWith(`~${sep}`) || path.startsWith("~/")) {
    const home = process.env.USERPROFILE ?? process.env.HOME ?? "";
    return join(home, path.slice(2));
  }
  return path;
}
