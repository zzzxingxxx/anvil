import type { TaskSummary } from "@anvil/protocol";
import { useUiStore } from "../store.ts";
import { client } from "../ws.ts";

const LABELS: Record<string, string> = {
  architect: "架构师",
  implementer: "实现者",
  reviewer: "审查者",
};

const STATUS: Record<string, string> = {
  queued: "排队",
  running: "运行",
  waiting_approval: "待审批",
  succeeded: "完成",
  failed: "失败",
  cancelled: "取消",
};

export function TaskTray() {
  const tasks = useUiStore((state) => state.tasks);
  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pb-2">
      <div className="rounded-xl border border-[#00000010] bg-white p-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10.5px] font-semibold text-[#7e7d77] uppercase tracking-wider">子任务</span>
          <button
            type="button"
            className="text-[10px] text-[#7e7d77] hover:text-[#1f1e1d]"
            onClick={async () => {
              try {
                await client.request("task.delegate", {
                  goal: "给 Host 加一个 /metrics 健康扩展字段",
                  persona: "architect",
                });
              } catch (error) {
                useUiStore.setState({
                  lastError: error instanceof Error ? error.message : String(error),
                });
              }
            }}
          >
            新子任务
          </button>
        </div>
        <div className="space-y-1">
          {tasks.slice(0, 6).map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TaskRow({ task }: { task: TaskSummary }) {
  const open = async () => {
    if (!task.sessionId) return;
    try {
      await client.request("session.resume", { id: task.sessionId });
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };
  const cancel = async () => {
    try {
      await client.request("task.cancel", { id: task.id });
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <div className="flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-[#f5f4ef]">
      <button type="button" onClick={open} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-1.5 text-[11px] text-[#1f1e1d]">
          <span>{LABELS[task.persona] ?? task.persona}</span>
          <span className="text-[#abaaa2]">{STATUS[task.status] ?? task.status}</span>
        </div>
        <div className="truncate text-[10.5px] text-[#7e7d77]">{task.goal}</div>
        {task.error ? <div className="text-[10px] text-amber-800">{task.error}</div> : null}
        {task.costUsd ? (
          <div className="text-[10px] font-mono text-[#abaaa2]">${task.costUsd.toFixed(4)}</div>
        ) : null}
      </button>
      {task.status === "running" || task.status === "queued" ? (
        <button type="button" onClick={cancel} className="text-[10px] text-[#abaaa2] hover:text-[#1f1e1d]">
          取消
        </button>
      ) : null}
    </div>
  );
}
