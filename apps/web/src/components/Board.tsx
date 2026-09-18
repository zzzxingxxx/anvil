import type { TaskSummary } from "@anvil/protocol";
import { useUiStore } from "../store.ts";
import { client } from "../ws.ts";
import { formatElapsed } from "../lib/utils.ts";
import { EmptyState } from "./EmptyState.tsx";

const PERSONA: Record<string, string> = {
  architect: "架构师",
  implementer: "实现者",
  reviewer: "审查者",
};

const COLUMNS = [
  { id: "todo", title: "待办", empty: "还没有排队的子任务。" },
  { id: "doing", title: "进行", empty: "没有进行中的子任务。" },
  { id: "blocked", title: "阻塞", empty: "没有阻塞项。" },
  { id: "done", title: "完成", empty: "还没有完成项。" },
] as const;

export function Board() {
  const tasks = useUiStore((state) => state.tasks);
  const busy = useUiStore((state) => state.agentStatus) === "running";

  const open = async (sessionId: string | null) => {
    if (!sessionId) {
      return;
    }
    try {
      await client.request("session.resume", { id: sessionId });
      useUiStore.getState().setActiveTab("chat");
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const move = async (id: string, column: (typeof COLUMNS)[number]["id"]) => {
    try {
      await client.request("board.move", { id, column });
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="min-h-0 h-full overflow-y-auto">
        <EmptyState
          className="h-full"
          title="还没有子任务"
          detail="在对话里输入 @agent:架构师 目标，或从任务托盘新建。拖到列上即可改状态。"
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 p-3 min-h-0 h-full overflow-y-auto overscroll-contain">
      {COLUMNS.map((column) => {
        const columnTasks = tasks.filter((task) => (task.column ?? columnFromStatus(task)) === column.id);
        return (
          <div
            key={column.id}
            className="rounded-xl bg-[#ffffff] border border-[#00000010] p-2 min-h-40 overflow-y-auto"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const id = event.dataTransfer.getData("text/anvil-task");
              if (id) {
                void move(id, column.id);
              }
            }}
          >
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="text-[10.5px] font-semibold text-[#7e7d77] uppercase tracking-wider">{column.title}</div>
              <span className="text-[10px] font-mono text-[#abaaa2]">{columnTasks.length}</span>
            </div>
            <div className="space-y-1.5 min-h-16">
              {columnTasks.length === 0 ? (
                <div className="text-[10.5px] text-[#abaaa2] px-1 py-3">{column.empty}</div>
              ) : null}
              {columnTasks.map((task) => (
                <article
                  key={task.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/anvil-task", task.id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  className="rounded-lg border border-[#00000010] p-2 bg-[#faf9f5] cursor-grab active:cursor-grabbing"
                >
                  <button
                    type="button"
                    className="text-[11px] font-medium text-[#1f1e1d] truncate text-left w-full hover:underline"
                    onClick={() => void open(task.sessionId)}
                    disabled={busy}
                    title={busy ? "等当前轮结束再打开子会话" : task.sessionId ? "打开子会话" : "还没有子会话文件"}
                  >
                    {task.goal}
                  </button>
                  <div className="text-[10px] text-[#abaaa2] mt-0.5">
                    {PERSONA[task.persona] ?? task.persona}
                    {task.startedAt ? ` · ${formatElapsed((task.endedAt ?? Date.now()) - task.startedAt)}` : ""}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {COLUMNS.filter((item) => item.id !== column.id).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="text-[10px] px-1.5 py-0.5 rounded bg-[#edece6] text-[#4f4e4a]"
                        onClick={() => move(task.id, item.id)}
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function columnFromStatus(task: TaskSummary): (typeof COLUMNS)[number]["id"] {
  if (task.status === "queued") return "todo";
  if (task.status === "running" || task.status === "waiting_approval") return "doing";
  if (task.status === "succeeded") return "done";
  return "blocked";
}
