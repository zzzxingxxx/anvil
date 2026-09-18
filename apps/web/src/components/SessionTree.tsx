import type { TreeNode } from "@anvil/protocol";
import { GitFork } from "lucide-react";
import { useEffect, useState } from "react";
import { useUiStore } from "../store.ts";
import { client } from "../ws.ts";

type MenuState = { x: number; y: number; node: TreeNode } | null;

export function SessionTree() {
  const tree = useUiStore((state) => state.tree);
  const currentEntryId = useUiStore((state) => state.currentEntryId);
  const busy = useUiStore((state) => state.agentStatus) === "running";
  const [menu, setMenu] = useState<MenuState>(null);

  useEffect(() => {
    if (!menu) {
      return;
    }
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  if (!tree) {
    return <p className="text-[11px] text-[#abaaa2] px-1">对话开始后会在这里长出分支树。</p>;
  }

  return (
    <div className="overflow-x-auto relative">
      <TreeBranch node={tree} currentId={currentEntryId} onMenu={setMenu} busy={busy} />
      {menu ? <NodeMenu menu={menu} onClose={() => setMenu(null)} busy={busy} /> : null}
    </div>
  );
}

function TreeBranch({
  node,
  currentId,
  onMenu,
  busy,
}: {
  node: TreeNode;
  currentId: string | null;
  onMenu: (menu: MenuState) => void;
  busy: boolean;
}) {
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
          disabled={busy}
          onDoubleClick={() => void navigate()}
          onClick={() => void navigate()}
          onContextMenu={(event) => {
            event.preventDefault();
            if (busy) {
              return;
            }
            onMenu({ x: event.clientX, y: event.clientY, node });
          }}
          className={`text-left text-[11px] px-1.5 py-0.5 rounded-md max-w-[180px] truncate disabled:opacity-40 ${
            active ? "bg-[#1f1e1d] text-white" : "hover:bg-[#edece6] text-[#4f4e4a]"
          }`}
          title={busy ? "等当前轮结束再切换分支" : "单击切换到此节点，右键更多操作"}
        >
          {node.status === "compressed" ? "▾ " : node.status === "error" ? "! " : ""}
          {node.summary}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void fork()}
          className="p-0.5 text-[#abaaa2] hover:text-[#1f1e1d] disabled:opacity-40"
          title={busy ? "等当前轮结束再分叉" : "从此分叉"}
        >
          <GitFork className="w-3 h-3" />
        </button>
      </div>
      {node.children.map((child) => (
        <TreeBranch key={child.id} node={child} currentId={currentId} onMenu={onMenu} busy={busy} />
      ))}
    </div>
  );
}

function NodeMenu({
  menu,
  onClose,
  busy,
}: {
  menu: NonNullable<MenuState>;
  onClose: () => void;
  busy: boolean;
}) {
  const run = async (action: () => Promise<unknown> | void) => {
    onClose();
    try {
      await action();
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <div
      className="fixed z-40 min-w-36 rounded-lg border border-[#00000014] bg-white py-1 shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
      style={{ left: menu.x, top: menu.y }}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        disabled={busy}
        className="w-full text-left px-3 py-1.5 text-[11px] text-[#1f1e1d] hover:bg-[#f5f4ef] disabled:opacity-40"
        onClick={() =>
          void run(() => client.request("session.fork", { entryId: menu.node.id }))
        }
      >
        Fork
      </button>
      <button
        type="button"
        disabled={busy}
        className="w-full text-left px-3 py-1.5 text-[11px] text-[#1f1e1d] hover:bg-[#f5f4ef] disabled:opacity-40"
        onClick={() =>
          void run(() => client.request("tree.navigate", { entryId: menu.node.id }))
        }
      >
        从这里继续
      </button>
      <button
        type="button"
        className="w-full text-left px-3 py-1.5 text-[11px] text-[#1f1e1d] hover:bg-[#f5f4ef]"
        onClick={() =>
          void run(async () => {
            try {
              await navigator.clipboard.writeText(menu.node.id);
            } catch (error) {
              throw error instanceof Error ? error : new Error("复制失败");
            }
          })
        }
      >
        复制节点 id
      </button>
    </div>
  );
}
