import type { TaskSummary } from "@anvil/protocol";
import { useEffect, useRef, useState } from "react";
import { useUiStore } from "../store.ts";
import { client } from "../ws.ts";
import { formatElapsed } from "../lib/utils.ts";

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
  const [banner, setBanner] = useState<{ text: string; tone: "succeeded" | "failed" | "cancelled" } | null>(
    null,
  );
  const previous = useRef(new Map<string, TaskSummary["status"]>());

  useEffect(() => {
    for (const task of tasks) {
      const was = previous.current.get(task.id);
      previous.current.set(task.id, task.status);
      if (!was || was === task.status) {
        continue;
      }
      if (task.status !== "succeeded" && task.status !== "failed" && task.status !== "cancelled") {
        continue;
      }
      const label = LABELS[task.persona] ?? task.persona;
      const result = STATUS[task.status] ?? task.status;
      setBanner({
        text: `${label}${result}：${task.goal.slice(0, 48)}`,
        tone: task.status,
      });
    }
  }, [tasks]);

  if (tasks.length === 0 && !banner) {
    return null;
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pb-2 space-y-1.5">
      {banner ? (
        <div
          className={`rounded-xl px-3 py-2 flex items-center justify-between gap-2 border ${
            banner.tone === "failed"
              ? "border-rose-200 bg-rose-50/80"
              : banner.tone === "cancelled"
                ? "border-amber-200 bg-amber-50/80"
                : "border-emerald-200 bg-emerald-50/80"
          }`}
        >
          <span
            className={`text-[11px] truncate ${
              banner.tone === "failed"
                ? "text-rose-900"
                : banner.tone === "cancelled"
                  ? "text-amber-900"
                  : "text-emerald-900"
            }`}
          >
            {banner.text}
          </span>
          <button
            type="button"
            className="text-[10px] text-[#7e7d77] hover:text-[#1f1e1d] shrink-0"
            onClick={() => setBanner(null)}
          >
            关闭
          </button>
        </div>
      ) : null}
      {tasks.length > 0 ? (
        <div className="rounded-xl border border-[#00000010] bg-white p-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10.5px] font-semibold text-[#7e7d77] uppercase tracking-wider">子任务</span>
            <button
              type="button"
              className="text-[10px] text-[#7e7d77] hover:text-[#1f1e1d]"
              onClick={() => {
                useUiStore.setState({ restoredDraft: "@agent:架构师 " });
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
      ) : null}
    </div>
  );
}

function TaskRow({ task }: { task: TaskSummary }) {
  const live = task.status === "running" || task.status === "waiting_approval";
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!live) {
      return;
    }
    const handle = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(handle);
  }, [live]);

  const elapsedMs = (task.endedAt ?? (live ? now : task.startedAt)) - task.startedAt;

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
          <span className="font-mono text-[10px] text-[#abaaa2]">{formatElapsed(elapsedMs)}</span>
        </div>
        <div className="truncate text-[10.5px] text-[#7e7d77]">{task.goal}</div>
        {task.error ? <div className="text-[10px] text-amber-800">{task.error}</div> : null}
        {task.costUsd ? (
          <div className="text-[10px] font-mono text-[#abaaa2]">${task.costUsd.toFixed(4)}</div>
        ) : null}
      </button>
      {task.status === "running" || task.status === "queued" || task.status === "waiting_approval" ? (
        <button type="button" onClick={cancel} className="text-[10px] text-[#abaaa2] hover:text-[#1f1e1d]">
          取消
        </button>
      ) : null}
    </div>
  );
}
