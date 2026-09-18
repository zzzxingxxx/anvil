import { useEffect, useState } from "react";
import { client } from "../ws.ts";
import { useUiStore } from "../store.ts";
import { formatRelativeTime } from "../lib/utils.ts";

type Item = { path: string; kind: string; mtime?: number };

export function ArtifactPanel() {
  const cwd = useUiStore((state) => state.cwd);
  const changes = useUiStore((state) => state.changes);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    if (!cwd) {
      setItems([]);
      return;
    }
    void client
      .request("artifact.list", {})
      .then((response) => {
        const payload = response.payload as { items?: Item[] };
        setItems(payload.items ?? []);
      })
      .catch(() => setItems([]));
  }, [cwd, changes]);

  if (!cwd) {
    return <div className="text-[11px] text-[#abaaa2]">打开工作区后显示快照。</div>;
  }
  if (items.length === 0) {
    return <div className="text-[11px] text-[#abaaa2]">还没有制品。假循环 Diff 在 `.anvil/demo-diff.txt`。</div>;
  }
  return (
    <div className="space-y-1 max-h-40 overflow-y-auto">
      {items.map((item) => (
        <button
          key={item.path}
          type="button"
          className="w-full flex items-center justify-between gap-2 text-left font-mono text-[10.5px] px-1.5 py-1 rounded hover:bg-[#f8f7f2]"
          onClick={async () => {
            try {
              const response = await client.request("fs.read", { path: `.anvil/artifacts/snapshots/${item.path}` });
              const payload = response.payload as { path: string; content: string; truncated?: boolean };
              useUiStore.getState().setPreview(payload);
            } catch (error) {
              useUiStore.setState({
                lastError: error instanceof Error ? error.message : String(error),
              });
            }
          }}
        >
          <span className="truncate">{item.path}</span>
          {item.mtime ? (
            <span className="ml-2 text-[9px] text-[#abaaa2]">{formatRelativeTime(item.mtime)}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
