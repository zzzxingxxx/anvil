import { realpath, stat } from "node:fs/promises";
import { isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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
  ".before",
  ".after",
  ".cmd",
  ".ps1",
  ".sh",
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

export async function pickSystemFolder(defaultPath?: string): Promise<string | null> {
  if (process.env.VITEST || process.env.CI) {
    return defaultPath ?? process.cwd();
  }
  if (process.platform === "win32") {
    const escapedDefault = defaultPath ? defaultPath.replace(/'/g, "''") : "";
    const script = `
Add-Type -AssemblyName System.Windows.Forms
$f = New-Object System.Windows.Forms.FolderBrowserDialog
$f.Description = '选择工作区工程目录'
$f.ShowNewFolderButton = $true
if ('${escapedDefault}' -and (Test-Path '${escapedDefault}')) { $f.SelectedPath = '${escapedDefault}' }
if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::Out.Write($f.SelectedPath)
}
`.trim();
    try {
      const { stdout } = await execFileAsync(
        "powershell.exe",
        ["-NoProfile", "-STA", "-Command", script],
        { timeout: 60000, windowsHide: true },
      );
      const picked = stdout.trim();
      return picked ? picked : null;
    } catch {
      return null;
    }
  }
  if (process.platform === "darwin") {
    try {
      const { stdout } = await execFileAsync(
        "osascript",
        ["-e", 'POSIX path of (choose folder with prompt "选择工作区工程目录")'],
        { timeout: 60000 },
      );
      const picked = stdout.trim().replace(/\/$/, "");
      return picked ? picked : null;
    } catch {
      return null;
    }
  }
  return null;
}
