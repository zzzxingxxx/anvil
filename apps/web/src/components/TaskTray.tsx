import type { TaskSummary } from "@anvil/protocol";
import { useEffect, useRef, useState } from "react";
import { Bot, Plus, X, ExternalLink, Clock } from "lucide-react";
import { useUiStore } from "../store.ts";
import { client } from "../ws.ts";
import { formatElapsed } from "../lib/utils.ts";

const LABELS: Record<string, string> = {
  architect: "架构师",
  implementer: "实现者",
  reviewer: "审查者",
};

const STATUS_CONFIG: Record<
  string,
  { label: string; badge: string; dot: string }
> = {
  queued: { label: "排队中", badge: "bg-stone-100 text-stone-700", dot: "bg-stone-400" },
  running: { label: "执行中", badge: "bg-blue-50 text-blue-700", dot: "bg-blue-500 animate-pulse" },
  waiting_approval: { label: "待审批", badge: "bg-amber-50 text-amber-700", dot: "bg-amber-500 animate-pulse" },
  succeeded: { label: "已完成", badge: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  failed: { label: "失败", badge: "bg-rose-50 text-rose-700", dot: "bg-rose-500" },
  cancelled: { label: "已取消", badge: "bg-stone-100 text-stone-500", dot: "bg-stone-300" },
};

export function TaskTray() {
  const tasks = useUiStore((state) => state.tasks);
  const [banner, setBanner] = useState<{
    text: string;
    tone: "succeeded" | "failed" | "cancelled";
  } | null>(null);
  const previous = useRef(new Map<string, TaskSummary["status"]>());

  useEffect(() => {
    for (const task of tasks) {
      const was = previous.current.get(task.id);
      previous.current.set(task.id, task.status);
      if (!was || was === task.status) continue;
      if (
        task.status !== "succeeded" &&
        task.status !== "failed" &&
        task.status !== "cancelled"
      ) {
        continue;
      }
      const label = LABELS[task.persona] ?? task.persona;
      const statusMeta = STATUS_CONFIG[task.status] ?? { label: task.status };
      setBanner({
        text: `${label}${statusMeta.label}：${task.goal.slice(0, 42)}`,
        tone: task.status,
      });
    }
  }, [tasks]);

  useEffect(() => {
    if (!banner) return;
    const handle = window.setTimeout(() => setBanner(null), 7_000);
    return () => window.clearTimeout(handle);
  }, [banner]);

  if (tasks.length === 0 && !banner) {
    return null;
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-3 sm:px-4 pb-2 space-y-2 select-none z-10">
      {banner ? (
        <div
          className={`rounded-xl px-3 py-2 flex items-center justify-between gap-2 border text-xs shadow-[var(--shadow-sm)] ${
            banner.tone === "failed"
              ? "border-rose-200 bg-rose-50/90 text-rose-900"
              : banner.tone === "cancelled"
                ? "border-amber-200 bg-amber-50/90 text-amber-900"
                : "border-emerald-200 bg-emerald-50/90 text-emerald-900"
          }`}
        >
          <span className="truncate font-medium">{banner.text}</span>
          <button
            type="button"
            className="text-[11px] opacity-70 hover:opacity-100 font-medium shrink-0"
            onClick={() => setBanner(null)}
          >
            关闭
          </button>
        </div>
      ) : null}

      {tasks.length > 0 ? (
        <div className="rounded-2xl border border-[var(--border-card)] bg-white p-3 shadow-[var(--shadow-card)] space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-[#7e7d77]" />
              <span className="text-[10.5px] font-semibold text-[#7e7d77] uppercase tracking-wider">
                子任务托盘 ({tasks.length})
              </span>
            </div>
            <button
              type="button"
              className="text-[11px] text-[#7e7d77] hover:text-[#1f1e1d] flex items-center gap-1 font-medium transition-colors"
              onClick={() => {
                useUiStore.setState({ restoredDraft: "@agent:架构师 " });
              }}
            >
              <Plus className="w-3 h-3" />
              <span>派发子任务</span>
            </button>
          </div>

          <div className="space-y-1 max-h-36 overflow-y-auto [scrollbar-width:none]">
            {tasks.slice(0, 5).map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TaskRow({ task }: { task: TaskSummary }) {
  const busy = useUiStore((state) => state.agentStatus) === "running";
  const live = task.status === "running" || task.status === "waiting_approval";
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!live) return;
    const handle = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(handle);
  }, [live]);

  const elapsedMs =
    (task.endedAt ?? (live ? now : task.startedAt)) - task.startedAt;
  const statusMeta = STATUS_CONFIG[task.status] ?? {
    label: task.status,
    badge: "bg-stone-100 text-stone-700",
    dot: "bg-stone-400",
  };

  const open = async () => {
    if (!task.sessionId) return;
    try {
      await client.request("session.resume", { id: task.sessionId });
      useUiStore.getState().setActiveTab("chat");
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
    <div className="flex items-center gap-2 p-2 rounded-xl hover:bg-[#faf9f5] border border-transparent hover:border-[#00000008] transition-all group">
      <button
        type="button"
        onClick={open}
        disabled={busy}
        title={busy ? "等当前轮结束再打开子会话" : undefined}
        className="min-w-0 flex-1 text-left disabled:opacity-40"
      >
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-[#1f1e1d]">
            {LABELS[task.persona] ?? task.persona}
          </span>
          {task.model ? (
            <span className="font-mono text-[10px] text-[#7e7d77] truncate max-w-[8rem]" title={task.model}>
              {task.model.split("/").pop()}
            </span>
          ) : null}
          <span
            className={`text-[9.5px] px-1.5 py-0.2 rounded-md font-mono flex items-center gap-1 ${statusMeta.badge}`}
          >
            <span className={`w-1 h-1 rounded-full ${statusMeta.dot}`} />
            {statusMeta.label}
          </span>
          <span className="font-mono text-[10px] text-[#abaaa2]">
            {formatElapsed(elapsedMs)}
          </span>
        </div>
        <div className="truncate text-[11px] text-[#7e7d77] mt-0.5">{task.goal}</div>
      </button>

      {task.sessionId ? (
        <button
          type="button"
          onClick={open}
          disabled={busy}
          title="打开子会话"
          className="p-1 rounded text-[#abaaa2] hover:text-[#1f1e1d] opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      ) : null}

      {live || task.status === "queued" ? (
        <button
          type="button"
          onClick={cancel}
          className="text-[10.5px] text-[#abaaa2] hover:text-rose-600 px-1.5 py-0.5 rounded transition-colors"
        >
          取消
        </button>
      ) : null}
    </div>
  );
}
