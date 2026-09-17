import { RotateCcw } from "lucide-react";
import { useUiStore } from "../store.ts";
import { client } from "../ws.ts";

export function DiffPanel() {
  const changes = useUiStore((state) => state.changes);

  if (changes.length === 0) {
    return <p className="text-[11px] text-[#abaaa2]">本轮还没有文件变更。</p>;
  }

  const restore = async (path: string) => {
    try {
      await client.request("artifact.restore", { path });
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <div className="space-y-2">
      {changes.map((change) => (
        <div key={change.path} className="rounded-lg border border-[#00000010] bg-white p-2">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[11px] text-[#1f1e1d] truncate">{change.path}</span>
            <button
              type="button"
              onClick={() => restore(change.path)}
              className="flex items-center gap-1 text-[10px] text-[#7e7d77] hover:text-[#1f1e1d]"
            >
              <RotateCcw className="w-3 h-3" />
              还原
            </button>
          </div>
          <pre className="text-[10.5px] leading-relaxed max-h-40 overflow-auto whitespace-pre-wrap text-[#4f4e4a]">
            {change.diff ?? change.kind}
          </pre>
        </div>
      ))}
    </div>
  );
}
