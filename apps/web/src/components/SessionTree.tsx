import type { TreeNode } from "@anvil/protocol";
import { GitFork } from "lucide-react";
import { useUiStore } from "../store.ts";
import { client } from "../ws.ts";

export function SessionTree() {
  const tree = useUiStore((state) => state.tree);
  const currentEntryId = useUiStore((state) => state.currentEntryId);

  if (!tree) {
    return <p className="text-[11px] text-[#abaaa2] px-1">对话开始后会在这里长出分支树。</p>;
  }

  return (
    <div className="overflow-x-auto">
      <TreeBranch node={tree} currentId={currentEntryId} />
    </div>
  );
}

function TreeBranch({ node, currentId }: { node: TreeNode; currentId: string | null }) {
  const active = node.current || node.id === currentId;
  const navigate = async () => {
    try {
      await client.request("tree.navigate", { entryId: node.id });
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };
  const fork = async () => {
    try {
      await client.request("session.fork", { entryId: node.id });
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <div className="pl-2 border-l border-[#00000010]">
      <div className="flex items-center gap-1 py-0.5">
        <button
          type="button"
          onDoubleClick={navigate}
          onClick={navigate}
          className={`text-left text-[11px] px-1.5 py-0.5 rounded-md max-w-[180px] truncate ${
            active ? "bg-[#1f1e1d] text-white" : "hover:bg-[#edece6] text-[#4f4e4a]"
          }`}
          title="单击切换到此节点"
        >
          {node.status === "compressed" ? "▾ " : ""}
          {node.summary}
        </button>
        <button type="button" onClick={fork} className="p-0.5 text-[#abaaa2] hover:text-[#1f1e1d]" title="从此分叉">
          <GitFork className="w-3 h-3" />
        </button>
      </div>
      {node.children.map((child) => (
        <TreeBranch key={child.id} node={child} currentId={currentId} />
      ))}
    </div>
  );
}
