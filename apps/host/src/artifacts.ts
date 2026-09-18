import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { ArtifactStore, unifiedDiff } from "@anvil/pi-ext-artifact";
import type { FileChange } from "@anvil/protocol";
import { resolveInside } from "./workspace.ts";
import type { WorkspaceState } from "./state.ts";

const execFileAsync = promisify(execFile);

export async function captureBefore(state: WorkspaceState, rawPath: string): Promise<void> {
  if (!state.cwd) {
    return;
  }
  let abs: string;
  try {
    abs = resolveInside(state.cwd, rawPath);
  } catch {
    return;
  }
  const rel = abs.slice(state.cwd.length).replace(/^[/\\]/, "").replace(/\\/g, "/");
  let before: string | null = null;
  try {
    before = await readFile(abs, "utf8");
  } catch {
    before = null;
  }
  const existing = state.snapshots[rel];
  state.snapshots[rel] = { before: existing?.before ?? before, after: existing?.after ?? null };
}

export async function captureAfter(state: WorkspaceState, rawPath: string): Promise<void> {
  if (!state.cwd) {
    return;
  }
  let abs: string;
  try {
    abs = resolveInside(state.cwd, rawPath);
  } catch {
    return;
  }
  const rel = abs.slice(state.cwd.length).replace(/^[/\\]/, "").replace(/\\/g, "/");
  let after: string | null = null;
  try {
    after = await readFile(abs, "utf8");
  } catch {
    after = null;
  }
  const prev = state.snapshots[rel] ?? { before: null, after: null };
  state.snapshots[rel] = { before: prev.before, after };
  const kind: FileChange["kind"] = prev.before == null ? "added" : after == null ? "deleted" : "modified";
  const git = await gitDiff(state.cwd, rel);
  const change: FileChange = {
    path: rel,
    kind,
    diff: git ?? unifiedDiff(rel, prev.before, after),
  };
  state.changes = [...state.changes.filter((item) => item.path !== rel), change];
  if (state.cwd) {
    const store = new ArtifactStore(state.cwd);
    await store.snapshotWrite(rel, after ?? "");
  }
}

export async function gitDiff(cwd: string, rel: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", cwd, "diff", "--", rel], {
      timeout: 4000,
      windowsHide: true,
      maxBuffer: 200_000,
    });
    const text = stdout.trim();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

export function toolPath(args: unknown): string | null {
  if (!args || typeof args !== "object") {
    return null;
  }
  const path = (args as { path?: unknown }).path;
  return typeof path === "string" && path.length > 0 ? path : null;
}
