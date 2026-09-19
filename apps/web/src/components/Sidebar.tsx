import {
  SquarePen,
  Compass,
  FolderOpen,
  FolderTree,
  X,
  LayoutGrid,
  MessageSquare,
  Settings2,
  Plug,
  BookOpen,
  Search,
  ChevronRight,
  FolderSync,
  Pencil,
  Trash2,
  Check,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useUiStore } from "../store.ts";
import { formatRelativeTime } from "../lib/utils.ts";
import { client } from "../ws.ts";
import { openWorkspace, pickAndOpenWorkspace } from "../lib/workspace.ts";
import { EmptyState } from "./EmptyState.tsx";

export function Sidebar() {
  const {
    sessionId,
    sessions,
    sidebarOpen,
    cwd,
    recentWorkspaces,
    agentStatus,
    toggleSidebar,
    activeTab,
    setActiveTab,
  } = useUiStore();
  const busy = agentStatus === "running";
  const [pathDraft, setPathDraft] = useState(cwd ?? "");
  const [showInput, setShowInput] = useState(false);
  const [picking, setPicking] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  useEffect(() => {
    setPathDraft(cwd ?? "");
  }, [cwd]);

  if (!sidebarOpen) return null;

  const closeIfNarrow = () => {
    if (window.matchMedia("(max-width: 1023px)").matches) {
      useUiStore.setState({ sidebarOpen: false });
    }
  };

  const handleNewSession = async () => {
    try {
      await client.request("session.new", {
        title: `探索分支 #${Math.floor(Math.random() * 900 + 100)}`,
      });
      useUiStore.getState().setActiveTab("chat");
      closeIfNarrow();
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handlePickAndOpen = async () => {
    if (busy || picking) return;
    setPicking(true);
    try {
      const opened = await pickAndOpenWorkspace();
      if (opened) {
        setPathDraft(opened);
        setShowInput(false);
        closeIfNarrow();
      }
    } finally {
      setPicking(false);
    }
  };

  const handleManualOpen = async (path: string) => {
    const ok = await openWorkspace(path);
    if (ok) {
      setShowInput(false);
      closeIfNarrow();
    }
  };

  const handleResume = async (id: string) => {
    try {
      await client.request("session.resume", { id });
      useUiStore.getState().setActiveTab("chat");
      closeIfNarrow();
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleRename = async (id: string) => {
    const title = renameDraft.trim();
    if (!title) {
      setRenamingId(null);
      return;
    }
    try {
      await client.request("session.rename", { id, title });
      setRenamingId(null);
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`删除会话「${title}」？jsonl 会从本机移走，无法恢复。`)) {
      return;
    }
    try {
      await client.request("session.delete", { id });
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const visibleSessions = useMemo(() => {
    const needle = historyQuery.trim().toLowerCase();
    if (!needle) {
      return sessions;
    }
    return sessions.filter((session) => {
      const hay = `${session.title} ${session.preview ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [sessions, historyQuery]);

  const folderName = cwd ? cwd.split(/[\\/]/).filter(Boolean).pop() || cwd : null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-x-0 top-12 bottom-7 z-20 bg-[#1f1e1d]/20 backdrop-blur-[2px] lg:hidden"
        aria-label="关闭侧边栏"
        onClick={toggleSidebar}
      />
      <aside className="fixed top-12 bottom-7 left-0 z-30 w-[min(19rem,88vw)] lg:static lg:inset-auto lg:z-auto lg:w-68 lg:h-full border-r border-[var(--border-subtle)] bg-[#f5f4ef] flex flex-col justify-between shrink-0 select-none text-xs text-[#3c3c3a]">
        <div className="flex flex-col h-full overflow-hidden">
          {/* 移动端标题与关闭按钮 */}
          <div className="flex items-center justify-between px-3.5 pt-3 pb-1 lg:hidden">
            <span className="font-semibold text-[#1f1e1d] text-[13px]">工作台导航</span>
            <button
              type="button"
              onClick={toggleSidebar}
              className="p-1 rounded-lg text-[#7e7d77] hover:text-[#1f1e1d] hover:bg-[#edece6]"
              aria-label="关闭侧边栏"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 工作区卡片区 */}
          <div className="p-3 border-b border-[#0000000a] space-y-2.5">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[10.5px] font-semibold text-[#7e7d77] uppercase tracking-wider">
                工作区工程
              </span>
              {cwd ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handlePickAndOpen}
                  className="text-[10.5px] text-[#5e5c54] hover:text-[#1f1e1d] flex items-center gap-1 disabled:opacity-40"
                  title="切换其他本地工程目录"
                >
                  <FolderSync className="w-3 h-3" />
                  <span>换目录</span>
                </button>
              ) : null}
            </div>

            {cwd ? (
              <div className="rounded-xl border border-[#00000010] bg-white p-2.5 shadow-[var(--shadow-sm)] space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#faf9f5] border border-[#0000000c] flex items-center justify-center shrink-0 text-[#1f1e1d]">
                    <FolderTree className="w-3.5 h-3.5 text-[#5e5c54]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[#1f1e1d] truncate text-xs" title={folderName ?? ""}>
                      {folderName}
                    </div>
                    <div className="text-[10px] text-[#abaaa2] truncate font-mono" title={cwd}>
                      {cwd}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={busy || picking}
                  onClick={handlePickAndOpen}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#1f1e1d] text-white text-xs font-medium shadow-[var(--shadow-sm)] hover:bg-[#343230] transition-all active:scale-[0.98] disabled:opacity-40"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>{picking ? "正在选择…" : "选择本地工程目录"}</span>
                </button>
              </div>
            )}

            {/* 手动路径快速输入折叠条 */}
            <div>
              {showInput || !cwd ? (
                <div className="space-y-1.5 pt-1">
                  <div className="flex gap-1.5">
                    <input
                      value={pathDraft}
                      onChange={(e) => setPathDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleManualOpen(pathDraft);
                        }
                      }}
                      placeholder="或直接粘贴绝对路径"
                      aria-label="工作区路径"
                      className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-[#00000012] bg-white text-[11px] outline-none focus:border-[#00000035] placeholder-[#abaaa2]"
                    />
                    <button
                      type="button"
                      onClick={() => handleManualOpen(pathDraft)}
                      disabled={busy || !pathDraft.trim()}
                      className="px-2.5 py-1.5 rounded-lg bg-[#edece6] hover:bg-[#e0ded6] text-[#1f1e1d] font-medium text-[11px] disabled:opacity-40 transition-colors"
                      title="打开指定路径"
                    >
                      打开
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowInput(true)}
                  className="px-0.5 text-[10.5px] text-[#abaaa2] hover:text-[#7e7d77] transition-colors"
                >
                  + 手动输入路径
                </button>
              )}
            </div>

            {/* 最近工作区列表 */}
            {recentWorkspaces.length > 0 ? (
              <div className="space-y-1 pt-1">
                <div className="text-[10px] text-[#abaaa2] px-0.5">最近工程</div>
                <div className="space-y-0.5 max-h-24 overflow-y-auto">
                  {recentWorkspaces.slice(0, 4).map((item) => {
                    const name = item.split(/[\\/]/).filter(Boolean).pop() || item;
                    const isCurrent = cwd === item;
                    return (
                      <button
                        key={item}
                        type="button"
                        disabled={busy || isCurrent}
                        title={item}
                        onClick={() => {
                          setPathDraft(item);
                          void handleManualOpen(item);
                        }}
                        className={`w-full text-left flex items-center justify-between px-2 py-1.5 rounded-lg text-[11px] transition-colors ${
                          isCurrent
                            ? "bg-[#edece6] text-[#1f1e1d] font-medium"
                            : "text-[#6e6d67] hover:bg-[#edece6] hover:text-[#1f1e1d] disabled:opacity-40"
                        }`}
                      >
                        <span className="truncate flex-1 pr-1">{name}</span>
                        <ChevronRight className="w-3 h-3 text-[#abaaa2] shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          {/* 新建会话与移动端 Tab */}
          <div className="p-3 border-b border-[#00000008] space-y-2">
            <button
              onClick={handleNewSession}
              disabled={busy}
              title={busy ? "等当前轮结束再新建会话" : undefined}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white hover:bg-[#fcfbf9] border border-[#00000010] text-[#1f1e1d] shadow-[var(--shadow-sm)] transition-all active:scale-[0.98] font-medium group disabled:opacity-40"
            >
              <span className="flex items-center gap-2">
                <SquarePen className="w-3.5 h-3.5 text-[#7e7d77] group-hover:text-[#1f1e1d] transition-colors" />
                <span className="text-xs">新建对话分支</span>
              </span>
              <span className="text-[10px] text-[#abaaa2] font-mono">⌘N</span>
            </button>

            {/* 移动端视图切换 */}
            <div className="grid grid-cols-3 gap-1 sm:hidden">
              {(
                [
                  { id: "chat", label: "对话", icon: MessageSquare },
                  { id: "board", label: "看板", icon: LayoutGrid },
                  { id: "mcp", label: "MCP", icon: Plug },
                  { id: "skills", label: "Skill", icon: BookOpen },
                  { id: "settings", label: "设置", icon: Settings2 },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const selected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id);
                      closeIfNarrow();
                    }}
                    className={`flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[10px] transition-colors ${
                      selected ? "bg-[#1f1e1d] text-white" : "text-[#7e7d77] hover:bg-[#edece6]"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  useUiStore.getState().setCommandOpen(true, "search");
                  closeIfNarrow();
                }}
                className="flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[10px] text-[#7e7d77] hover:bg-[#edece6]"
              >
                <Search className="w-3.5 h-3.5" />
                搜索
              </button>
            </div>
          </div>

          {/* 会话列表 */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-2.5 py-3 space-y-3">
            <div>
              <div className="px-2 pb-1.5 text-[10.5px] font-semibold text-[#7e7d77] uppercase tracking-wider flex items-center justify-between">
                <span>历史会话</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#0000000a] text-[#7e7d77] font-mono">
                  {visibleSessions.length}/{sessions.length}
                </span>
              </div>
              {sessions.length > 0 ? (
                <div className="px-1 pb-2">
                  <label className="sr-only" htmlFor="session-history-search">
                    搜索历史会话
                  </label>
                  <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-[#00000010] bg-white">
                    <Search className="w-3 h-3 text-[#abaaa2] shrink-0" />
                    <input
                      id="session-history-search"
                      value={historyQuery}
                      onChange={(e) => setHistoryQuery(e.target.value)}
                      placeholder="搜标题或首句"
                      className="w-full bg-transparent text-[11px] text-[#1f1e1d] outline-none placeholder:text-[#abaaa2]"
                    />
                  </div>
                </div>
              ) : null}
              <div className="space-y-1">
                {sessions.length === 0 ? (
                  <EmptyState
                    className="py-6 px-2 max-w-none"
                    title="还没有会话"
                    detail="打开工作区后新建一条，或开始提问。"
                  />
                ) : visibleSessions.length === 0 ? (
                  <EmptyState
                    className="py-6 px-2 max-w-none"
                    title="没有匹配的会话"
                    detail="换个关键词，或清空搜索。"
                  />
                ) : (
                  visibleSessions.map((session) => {
                    const active = session.id === sessionId;
                    const renaming = renamingId === session.id;
                    return (
                      <div
                        key={session.id}
                        className={`group rounded-xl border transition-all ${
                          active
                            ? "bg-white border-[#00000018] text-[#1f1e1d] shadow-[var(--shadow-sm)]"
                            : "hover:bg-[#edece6] text-[#4f4e4a] border-transparent"
                        }`}
                      >
                        {renaming ? (
                          <form
                            className="flex items-center gap-1 px-2 py-1.5"
                            onSubmit={(event) => {
                              event.preventDefault();
                              void handleRename(session.id);
                            }}
                          >
                            <input
                              autoFocus
                              value={renameDraft}
                              onChange={(e) => setRenameDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                  e.preventDefault();
                                  setRenamingId(null);
                                }
                              }}
                              className="flex-1 min-w-0 px-2 py-1 rounded-md border border-[#00000018] bg-white text-xs outline-none"
                            />
                            <button
                              type="submit"
                              className="p-1 rounded-md text-emerald-700 hover:bg-emerald-50"
                              title="保存标题"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </form>
                        ) : (
                          <div className="flex items-start gap-1 pr-1">
                            <button
                              type="button"
                              disabled={busy && !active}
                              title={busy && !active ? "等当前轮结束再切换会话" : session.preview || session.title}
                              onClick={() => void handleResume(session.id)}
                              className="flex-1 min-w-0 flex items-center gap-2 px-2.5 py-2 text-left disabled:opacity-40"
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  active ? "bg-emerald-500 ring-2 ring-emerald-500/20" : "bg-[#d6d4cc]"
                                }`}
                              />
                              <div className="flex flex-col truncate">
                                <span className="font-medium truncate text-xs">{session.title}</span>
                                <span className="text-[10px] text-[#abaaa2] truncate">
                                  {formatRelativeTime(session.mtime)}
                                  {typeof session.tokens === "number" ? ` · ${session.tokens} 条` : ""}
                                </span>
                                {session.preview && session.preview !== session.title ? (
                                  <span className="text-[10px] text-[#abaaa2] truncate">{session.preview}</span>
                                ) : null}
                              </div>
                            </button>
                            <div className="flex items-center pt-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                              <button
                                type="button"
                                disabled={busy}
                                title="重命名"
                                onClick={() => {
                                  setRenamingId(session.id);
                                  setRenameDraft(session.title);
                                }}
                                className="p-1 rounded-md text-[#7e7d77] hover:text-[#1f1e1d] hover:bg-white disabled:opacity-40"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                title="删除会话"
                                onClick={() => void handleDelete(session.id, session.title)}
                                className="p-1 rounded-md text-[#7e7d77] hover:text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* 底部信息 */}
          <div className="p-3 border-t border-[#0000000a] bg-[#edece6]/40 flex items-center justify-between text-[11px] text-[#7e7d77]">
            <div className="flex items-center gap-1.5 font-medium">
              <Compass className="w-3.5 h-3.5 text-[#7e7d77]" />
              <span>Pi 官方微内核宿主</span>
            </div>
            <span className="font-mono text-[10px] text-[#abaaa2] bg-[#00000006] px-1.5 py-0.5 rounded">v0.1</span>
          </div>
        </div>
      </aside>
    </>
  );
}
