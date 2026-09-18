import type { FsEntry } from "@anvil/protocol";
import { ChevronRight, FileText, Folder } from "lucide-react";
import { useEffect, useState } from "react";
import { useUiStore } from "../store.ts";
import { client } from "../ws.ts";

export function FileTree() {
  const cwd = useUiStore((state) => state.cwd);
  const preview = useUiStore((state) => state.preview);
  const changes = useUiStore((state) => state.changes);
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [path, setPath] = useState<string | null>(null);

  useEffect(() => {
    if (!cwd) {
      setEntries([]);
      setPath(null);
      return;
    }
    void load(cwd);
  }, [cwd]);

  useEffect(() => {
    if (!cwd || !path) {
      return;
    }
    void load(path);
  }, [changes]);

  const load = async (next: string) => {
    try {
      const response = await client.request("fs.tree", { path: next });
      const payload = response.payload as { path: string; entries: FsEntry[] };
      setPath(payload.path);
      setEntries(payload.entries ?? []);
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const openFile = async (entry: FsEntry) => {
    if (entry.kind === "dir") {
      await load(entry.path);
      return;
    }
    try {
      const response = await client.request("fs.read", { path: entry.path });
      const payload = response.payload as { path: string; content: string; truncated?: boolean };
      useUiStore.getState().setPreview(payload);
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  if (!cwd) {
    return <p className="text-[11px] text-[#abaaa2] px-1">打开工作区后可浏览文件。</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="truncate text-[10px] font-mono text-[#abaaa2]" title={path ?? cwd}>
          {path ?? cwd}
        </span>
        {path && !samePath(path, cwd) ? (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className="text-[10px] text-[#7e7d77] hover:text-[#1f1e1d]"
              onClick={() => {
                const parent = parentInside(cwd, path);
                void load(parent ?? cwd);
              }}
            >
              上一级
            </button>
            <button type="button" className="text-[10px] text-[#7e7d77] hover:text-[#1f1e1d]" onClick={() => load(cwd)}>
              回到根
            </button>
          </div>
        ) : null}
      </div>
      <div className="space-y-0.5 max-h-48 overflow-y-auto">
        {entries.map((entry) => (
          <button
            key={entry.path}
            type="button"
            onClick={() => openFile(entry)}
            className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded-md hover:bg-[#edece6] text-left"
          >
            {entry.kind === "dir" ? (
              <Folder className="w-3 h-3 text-[#7e7d77]" />
            ) : (
              <FileText className="w-3 h-3 text-[#7e7d77]" />
            )}
            <span className="truncate">{entry.name}</span>
            {entry.kind === "dir" ? <ChevronRight className="w-3 h-3 ml-auto text-[#abaaa2]" /> : null}
          </button>
        ))}
      </div>
      {preview ? (
        <div className="rounded-lg border border-[#00000010] bg-white p-2">
          <div className="flex items-center justify-between mb-1">
            <span className="truncate text-[10px] font-mono text-[#7e7d77]">{preview.path}</span>
            <button type="button" className="text-[10px] text-[#abaaa2]" onClick={() => useUiStore.getState().setPreview(null)}>
              关闭
            </button>
          </div>
          <pre className="text-[10.5px] leading-relaxed max-h-40 overflow-auto whitespace-pre-wrap text-[#4f4e4a]">
            {preview.content}
            {preview.truncated ? "\n…（已截断）" : ""}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

function samePath(left: string, right: string): boolean {
  return normalizePath(left) === normalizePath(right);
}

function parentInside(cwd: string, current: string): string | null {
  const root = normalizePath(cwd);
  const value = normalizePath(current);
  if (value === root) {
    return null;
  }
  const sep = current.includes("\\") ? "\\" : "/";
  const idx = current.lastIndexOf(sep);
  if (idx <= 0) {
    return cwd;
  }
  const parent = current.slice(0, idx);
  const normalizedParent = normalizePath(parent);
  if (normalizedParent.length < root.length || (normalizedParent !== root && !normalizedParent.startsWith(`${root}/`))) {
    return cwd;
  }
  return parent;
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}
