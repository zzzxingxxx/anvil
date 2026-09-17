import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import type { FsEntry } from "@anvil/protocol";
import { looksText, resolveInside, shouldIgnoreName } from "./workspace.ts";

const MAX_READ_BYTES = 512 * 1024;

export async function listTree(cwd: string, path?: string): Promise<{ path: string; entries: FsEntry[] }> {
  const target = resolveInside(cwd, path ?? cwd);
  const names = await readdir(target, { withFileTypes: true });
  const entries: FsEntry[] = [];
  for (const entry of names) {
    if (shouldIgnoreName(entry.name)) {
      continue;
    }
    const full = join(target, entry.name);
    entries.push({
      name: entry.name,
      path: full,
      kind: entry.isDirectory() ? "dir" : "file",
    });
  }
  entries.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === "dir" ? -1 : 1;
    }
    return a.name.localeCompare(b.name, "zh-CN");
  });
  return { path: target, entries };
}

export async function readTextFile(
  cwd: string,
  path: string,
): Promise<{ path: string; content: string; truncated: boolean }> {
  const target = resolveInside(cwd, path);
  const info = await stat(target);
  if (!info.isFile()) {
    throw new Error("不是文件");
  }
  if (!looksText(target) && info.size > 64 * 1024) {
    throw new Error("该文件可能是二进制，已跳过预览");
  }
  if (info.size > MAX_READ_BYTES) {
    const handle = await readFile(target);
    const slice = handle.subarray(0, MAX_READ_BYTES);
    return {
      path: relative(cwd, target) || basename(target),
      content: slice.toString("utf8"),
      truncated: true,
    };
  }
  const buf = await readFile(target);
  if (buf.includes(0)) {
    throw new Error("二进制文件不支持预览");
  }
  return {
    path: relative(cwd, target) || basename(target),
    content: buf.toString("utf8"),
    truncated: false,
  };
}
