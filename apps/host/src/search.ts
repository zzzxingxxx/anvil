import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import type { FsSearchHit } from "@anvil/protocol";
import { shouldIgnoreName } from "./workspace.ts";

const LIMIT = 50;

export async function searchFiles(cwd: string, query: string): Promise<FsSearchHit[]> {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [];
  }
  const hits: FsSearchHit[] = [];
  await walk(cwd, cwd, needle, hits);
  return hits.slice(0, LIMIT);
}

async function walk(cwd: string, dir: string, needle: string, hits: FsSearchHit[]): Promise<void> {
  if (hits.length >= LIMIT) {
    return;
  }
  let names;
  try {
    names = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of names) {
    if (hits.length >= LIMIT) {
      return;
    }
    if (shouldIgnoreName(entry.name) && entry.name !== ".anvil-dev.json") {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(cwd, full, needle, hits);
      continue;
    }
    const rel = relative(cwd, full).replace(/\\/g, "/");
    if (rel.toLowerCase().includes(needle) || entry.name.toLowerCase().includes(needle)) {
      hits.push({ path: rel, name: entry.name });
    }
  }
}

export async function existsFile(path: string): Promise<boolean> {
  try {
    const info = await stat(path);
    return info.isFile();
  } catch {
    return false;
  }
}
