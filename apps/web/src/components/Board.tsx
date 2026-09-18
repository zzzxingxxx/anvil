import { useState } from "react";
import type { TaskSummary } from "@anvil/protocol";
import {
  LayoutGrid,
  Clock,
  ExternalLink,
  Bot,
  AlertCircle,
  CheckCircle2,
  ListTodo,
  PlayCircle,
  ArrowRight,
} from "lucide-react";
import { useUiStore } from "../store.ts";
import { client } from "../ws.ts";
import { formatElapsed, formatTime } from "../lib/utils.ts";
import { EmptyState } from "./EmptyState.tsx";

const PERSONA_CONFIG: Record<
  string,
  { label: string; badge: string; border: string; text: string }
> = {
  architect: {
    label: "架构师",
    badge: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-700",
  },
  implementer: {
    label: "实现者",
    badge: "bg-sky-50",
    border: "border-sky-200",
    text: "text-sky-700",
  },
  reviewer: {
    label: "审查者",
    badge: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
  },
};

const COLUMNS = [
  {
    id: "todo",
    title: "待办",
    english: "TO DO",
    icon: ListTodo,
    color: "text-stone-600",
    badge: "bg-stone-100 text-stone-700",
    empty: "暂无排队中的子任务",
  },
  {
    id: "doing",
    title: "进行中",
    english: "IN PROGRESS",
    icon: PlayCircle,
    color: "text-blue-600",
    badge: "bg-blue-50 text-blue-700",
    empty: "暂无正在执行的子任务",
  },
  {
    id: "blocked",
    title: "阻塞中",
    english: "BLOCKED",
    icon: AlertCircle,
    color: "text-amber-600",
    badge: "bg-amber-50 text-amber-700",
    empty: "当前无阻塞项",
  },
  {
    id: "done",
    title: "已完成",
    english: "DONE",
    icon: CheckCircle2,
    color: "text-emerald-600",
    badge: "bg-emerald-50 text-emerald-700",
    empty: "还没有已完成的任务",
  },
] as const;

function columnFromStatus(task: TaskSummary): (typeof COLUMNS)[number]["id"] {
  if (task.error) return "blocked";
  if (task.status === "succeeded") return "done";
  if (task.status === "running") return "doing";
  return "todo";
}

export function Board() {
  const tasks = useUiStore((state) => state.tasks);
  const busy = useUiStore((state) => state.agentStatus) === "running";
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const open = async (sessionId: string | null) => {
    if (!sessionId) return;
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
      <div className="min-h-0 h-full overflow-y-auto flex items-center justify-center p-6">
        <EmptyState
          icon={<LayoutGrid className="w-5 h-5 text-[#7e7d77]" />}
          title="还没有智能体任务"
          detail="在对话输入框中输入 @agent:架构师 / @agent:实现者 / @agent:审查者 加上目标，或在任务栏派发。派发后将在此看板以卡片管理进度。"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-[var(--bg-app)]">
      {/* 看板顶栏状态 */}
      <div className="px-4 sm:px-6 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between bg-white/60 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-4 h-4 text-[#7e7d77]" />
          <h2 className="font-semibold text-xs text-[#1f1e1d]">子任务协作看板</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0000000a] text-[#7e7d77] font-mono">
            {tasks.length} 项任务
          </span>
        </div>
        <div className="text-[11px] text-[#7e7d77]">
          拖拽卡片可直接调整任务状态
        </div>
      </div>

      {/* 看板 4 列网格 */}
      <div className="flex-1 min-h-0 p-4 sm:p-6 overflow-x-auto overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 h-full min-w-[760px]">
          {COLUMNS.map((column) => {
            const columnTasks = tasks.filter(
              (task) => (task.column ?? columnFromStatus(task)) === column.id,
            );
            const Icon = column.icon;
            const isHovered = dragOverCol === column.id;

            return (
              <div
                key={column.id}
                className={`flex flex-col rounded-2xl border transition-all h-full max-h-full ${
                  isHovered
                    ? "bg-[#faf8f2] border-[#1f1e1d]/30 ring-2 ring-[#1f1e1d]/10"
                    : "bg-[#ffffff] border-[var(--border-card)] shadow-[var(--shadow-card)]"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverCol(column.id);
                }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverCol(null);
                  const id = e.dataTransfer.getData("text/anvil-task");
                  if (id) {
                    void move(id, column.id);
                  }
                }}
              >
                {/* 列标头 */}
                <div className="flex items-center justify-between px-3.5 py-3 border-b border-[#00000008] bg-[#faf9f5]/70 rounded-t-2xl">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-3.5 h-3.5 ${column.color}`} />
                    <span className="font-semibold text-xs text-[#1f1e1d]">
                      {column.title}
                    </span>
                    <span className="text-[9px] text-[#abaaa2] font-mono uppercase tracking-wider hidden sm:inline">
                      {column.english}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full ${column.badge}`}
                  >
                    {columnTasks.length}
                  </span>
                </div>

                {/* 卡片容器 */}
                <div className="flex-1 p-2.5 overflow-y-auto space-y-2.5 [scrollbar-width:none]">
                  {columnTasks.length === 0 ? (
                    <div className="h-32 rounded-xl border border-dashed border-[#00000010] flex flex-col items-center justify-center p-3 text-center">
                      <span className="text-[11px] text-[#abaaa2]">{column.empty}</span>
                    </div>
                  ) : null}

                  {columnTasks.map((task) => {
                    const personaMeta = PERSONA_CONFIG[task.persona] ?? {
                      label: task.persona,
                      badge: "bg-stone-50",
                      border: "border-stone-200",
                      text: "text-stone-700",
                    };
                    const elapsed =
                      task.startedAt && task.endedAt
                        ? task.endedAt - task.startedAt
                        : null;

                    return (
                      <article
                        key={task.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/anvil-task", task.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        className="rounded-xl border border-[#00000010] bg-[#faf9f5] hover:bg-white hover:border-[#00000018] hover:shadow-[var(--shadow-card)] transition-all p-3 cursor-grab active:cursor-grabbing group space-y-2 select-none"
                      >
                        {/* 角色与状态顶标 */}
                        <div className="flex items-center justify-between gap-1 text-[10.5px]">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-medium ${personaMeta.badge} ${personaMeta.border} ${personaMeta.text}`}
                          >
                            <Bot className="w-3 h-3" />
                            <span>{personaMeta.label}</span>
                            {task.model ? (
                              <span className="font-mono font-normal opacity-80 max-w-[7rem] truncate">
                                {task.model.split("/").pop()}
                              </span>
                            ) : null}
                          </span>

                          {task.status === "running" ? (
                            <span className="flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-mono">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                              进行中
                            </span>
                          ) : null}
                        </div>

                        {/* 任务目标文字 */}
                        <div className="font-medium text-xs text-[#1f1e1d] leading-snug line-clamp-3">
                          {task.goal}
                        </div>

                        {/* 摘要与输出 */}
                        {task.summary ? (
                          <div className="text-[10.5px] text-[#7e7d77] bg-white/80 p-2 rounded-lg border border-[#00000008] line-clamp-2 leading-relaxed">
                            {task.summary}
                          </div>
                        ) : null}

                        {/* 错误提示 */}
                        {task.error ? (
                          <div className="text-[10px] text-rose-700 bg-rose-50 border border-rose-200/60 p-1.5 rounded-lg">
                            {task.error}
                          </div>
                        ) : null}

                        {/* 卡片底栏信息与跳转 */}
                        <div className="pt-1 border-t border-[#00000008] flex items-center justify-between text-[10px] text-[#abaaa2] font-mono">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>
                              {elapsed != null
                                ? formatElapsed(elapsed)
                                : formatTime(task.startedAt)}
                            </span>
                          </span>

                          {task.sessionId ? (
                            <button
                              type="button"
                              onClick={() => void open(task.sessionId)}
                              disabled={busy}
                              className="text-[10.5px] font-sans text-[#4f4e4a] hover:text-[#1f1e1d] flex items-center gap-1 group-hover:underline disabled:opacity-40"
                              title="打开子任务对应会话"
                            >
                              <span>查看会话</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
