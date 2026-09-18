import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

export type SnapshotRecord = {
  path: string;
  before: string | null;
  after: string | null;
};

const MAX_BYTES = 2 * 1024 * 1024;

export class ArtifactStore {
  constructor(private readonly cwd: string) {}

  root(): string {
    return join(this.cwd, ".anvil", "artifacts", "snapshots");
  }

  async snapshotWrite(relPath: string, nextContent: string | Buffer): Promise<SnapshotRecord> {
    const abs = join(this.cwd, relPath);
    let before: string | null = null;
    try {
      const info = await stat(abs);
      if (info.size > MAX_BYTES) {
        before = `<skipped ${(info.size / 1024).toFixed(0)}KB>`;
      } else {
        before = await readFile(abs, "utf8");
      }
    } catch {
      before = null;
    }
    const after = typeof nextContent === "string" ? nextContent : nextContent.toString("utf8");
    const turn = String(Date.now());
    const dest = join(this.root(), turn, relPath);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(`${dest}.before`, before ?? "", "utf8");
    await writeFile(`${dest}.after`, after, "utf8");
    return { path: relPath.replace(/\\/g, "/"), before, after };
  }

  async list(limit = 40): Promise<Array<{ path: string; kind: "snapshot" | "other"; mtime?: number }>> {
    const root = this.root();
    const items: Array<{ path: string; kind: "snapshot" | "other"; mtime?: number }> = [];
    await walk(root, root, items, limit);
    return items.sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0)).slice(0, limit);
  }

  async restore(relPath: string, before: string | null): Promise<void> {
    const abs = join(this.cwd, relPath);
    if (before == null) {
      return;
    }
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, before, "utf8");
  }
}

export function unifiedDiff(path: string, before: string | null, after: string | null): string {
  const a = (before ?? "").split(/\r?\n/);
  const b = (after ?? "").split(/\r?\n/);
  const lines = [`--- a/${path}`, `+++ b/${path}`];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i += 1) {
    const left = a[i];
    const right = b[i];
    if (left === right) {
      if (left !== undefined) {
        lines.push(` ${left}`);
      }
      continue;
    }
    if (left !== undefined) {
      lines.push(`-${left}`);
    }
    if (right !== undefined) {
      lines.push(`+${right}`);
    }
  }
  return lines.join("\n");
}

async function walk(
  root: string,
  dir: string,
  items: Array<{ path: string; kind: "snapshot" | "other"; mtime?: number }>,
  limit: number,
): Promise<void> {
  if (items.length >= limit) return;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (items.length >= limit) return;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(root, full, items, limit);
      continue;
    }
    const info = await stat(full).catch(() => null);
    items.push({
      path: relative(root, full).replace(/\\/g, "/"),
      kind: "snapshot",
      mtime: info?.mtimeMs,
    });
  }
}
