import type { TaskSummary } from "@anvil/protocol";
import { useUiStore } from "../store.ts";
import { client } from "../ws.ts";

const COLUMNS = [
  { id: "todo", title: "待办" },
  { id: "doing", title: "进行" },
  { id: "blocked", title: "阻塞" },
  { id: "done", title: "完成" },
] as const;

export function Board() {
  const tasks = useUiStore((state) => state.tasks);

  const move = async (id: string, column: (typeof COLUMNS)[number]["id"]) => {
    try {
      await client.request("board.move", { id, column });
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <div className="grid grid-cols-4 gap-2 p-3 min-h-0 h-full">
      {COLUMNS.map((column) => (
        <div key={column.id} className="rounded-xl bg-[#ffffff] border border-[#00000010] p-2 min-h-0 overflow-y-auto">
          <div className="text-[10.5px] font-semibold text-[#7e7d77] uppercase tracking-wider mb-2">
            {column.title}
          </div>
          <div className="space-y-1.5">
            {tasks
              .filter((task) => (task.column ?? columnFromStatus(task)) === column.id)
              .map((task) => (
                <article key={task.id} className="rounded-lg border border-[#00000010] p-2 bg-[#faf9f5]">
                  <div className="text-[11px] font-medium text-[#1f1e1d] truncate">{task.goal}</div>
                  <div className="text-[10px] text-[#abaaa2] mt-0.5">{task.persona}</div>
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
      ))}
    </div>
  );
}

function columnFromStatus(task: TaskSummary): (typeof COLUMNS)[number]["id"] {
  if (task.status === "queued") return "todo";
  if (task.status === "running" || task.status === "waiting_approval") return "doing";
  if (task.status === "succeeded") return "done";
  return "blocked";
}
