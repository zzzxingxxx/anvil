import { SquarePen, GitBranch, Compass, FolderOpen, X, LayoutGrid, MessageSquare, Settings2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useUiStore } from "../store.ts";
import { formatRelativeTime } from "../lib/utils.ts";
import { client } from "../ws.ts";
import { EmptyState } from "./EmptyState.tsx";

export function Sidebar() {
  const { sessionId, sessions, sidebarOpen, cwd, recentWorkspaces, agentStatus, toggleSidebar, activeTab, setActiveTab } =
    useUiStore();
  const busy = agentStatus === "running";
  const [pathDraft, setPathDraft] = useState(cwd ?? "");

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

  const handleOpen = async (path: string) => {
    const trimmed = path.trim();
    if (!trimmed) return;
    try {
      await client.request("workspace.open", { path: trimmed });
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const pickFolder = async () => {
    const native = window.anvilDesktop;
    if (!native) return;
    const picked = await native.pickFolder();
    if (!picked) return;
    setPathDraft(picked);
    await handleOpen(picked);
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

  return (
    <>
      <button
        type="button"
        className="fixed inset-x-0 top-12 bottom-7 z-20 bg-[#1f1e1d]/20 backdrop-blur-[1px] lg:hidden"
        aria-label="关闭侧边栏"
        onClick={toggleSidebar}
      />
      <aside className="fixed top-12 bottom-7 left-0 z-30 w-[min(18rem,86vw)] lg:static lg:inset-auto lg:z-auto lg:w-64 lg:h-full border-r border-[var(--border-subtle)] bg-[#f5f4ef] flex flex-col justify-between shrink-0 select-none text-xs text-[#3c3c3a]">
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between px-3 pt-3 pb-1 lg:hidden">
            <span className="font-semibold text-[#1f1e1d]">工作区</span>
            <button
              type="button"
              onClick={toggleSidebar}
              className="p-1 rounded-md text-[#7e7d77] hover:text-[#1f1e1d] hover:bg-[#edece6]"
              aria-label="关闭侧边栏"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-3 border-b border-[#00000008] space-y-2">
            <label className="text-[10.5px] font-semibold text-[#7e7d77] uppercase tracking-wider px-0.5">
              打开工作区
            </label>
            <div className="flex gap-1.5">
              <input
                value={pathDraft}
                onChange={(event) => setPathDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleOpen(pathDraft);
                  }
                }}
                placeholder="粘贴本机目录路径"
                aria-label="工作区路径"
                className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-[#00000012] bg-white text-[11px] outline-none focus:border-[#00000030]"
              />
              {typeof window !== "undefined" && window.anvilDesktop ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void pickFolder()}
                  className="px-2 rounded-lg border border-[#00000014] bg-white text-[#1f1e1d] disabled:opacity-40"
                  title={busy ? "等当前轮结束再打开工作区" : "系统文件夹对话框"}
                >
                  选
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => handleOpen(pathDraft)}
                disabled={busy}
                className="px-2 rounded-lg bg-[#1f1e1d] text-white disabled:opacity-40"
                title={busy ? "等当前轮结束再打开工作区" : "打开"}
                aria-label="打开工作区"
              >
                <FolderOpen className="w-3.5 h-3.5" />
              </button>
            </div>
            {recentWorkspaces.length > 0 ? (
              <div className="space-y-0.5">
                {recentWorkspaces.slice(0, 4).map((item) => (
                  <button
                    key={item}
                    type="button"
                    disabled={busy}
                    title={busy ? "等当前轮结束再打开工作区" : item}
                    onClick={() => {
                      setPathDraft(item);
                      void handleOpen(item);
                    }}
                    className="w-full text-left truncate px-2 py-1 rounded-md text-[10.5px] text-[#7e7d77] hover:bg-[#edece6] hover:text-[#1f1e1d] disabled:opacity-40"
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : (
              <p className="px-0.5 text-[10.5px] text-[#abaaa2] leading-relaxed">
                浏览器不能弹系统文件框。粘贴本机路径即可。
              </p>
            )}
          </div>

          <div className="p-3 border-b border-[#00000008] space-y-2">
            <button
              onClick={handleNewSession}
              disabled={busy}
              title={busy ? "等当前轮结束再新建会话" : undefined}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#ffffff] hover:bg-[#fcfbf9] border border-[#00000012] text-[#1f1e1d] shadow-[var(--shadow-sm)] transition-all active:scale-[0.98] font-medium group disabled:opacity-40 disabled:hover:bg-[#ffffff]"
            >
              <span className="flex items-center gap-2">
                <SquarePen className="w-3.5 h-3.5 text-[#7e7d77] group-hover:text-[#1f1e1d] transition-colors" />
                <span className="text-xs">新建会话</span>
              </span>
            </button>
            <div className="grid grid-cols-4 gap-1 sm:hidden">
              {(
                [
                  { id: "chat", label: "对话", icon: MessageSquare },
                  { id: "board", label: "看板", icon: LayoutGrid },
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
                    className={`flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[10px] ${
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

          <div className="flex-1 overflow-y-auto overscroll-contain px-2.5 py-3 space-y-5">
            <div>
              <div className="px-2 pb-1.5 text-[10.5px] font-semibold text-[#7e7d77] uppercase tracking-wider flex items-center justify-between">
                <span>会话</span>
                <span className="text-[9px] px-1.5 rounded-full bg-[#0000000a] text-[#7e7d77] font-mono">
                  {sessions.length}
                </span>
              </div>
              <div className="space-y-1">
                {sessions.length === 0 ? (
                  <EmptyState
                    className="py-6 px-2 max-w-none"
                    title="还没有会话"
                    detail="打开工作区后新建一条，或从最近路径恢复。"
                  />
                ) : (
                  sessions.map((session) => {
                    const active = session.id === sessionId;
                    return (
                      <button
                        key={session.id}
                        type="button"
                        disabled={busy && !active}
                        title={busy && !active ? "等当前轮结束再切换会话" : session.title}
                        onClick={() => handleResume(session.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left disabled:opacity-40 ${
                          active
                            ? "bg-[#ffffff] border border-[#00000018] text-[#1f1e1d] shadow-[var(--shadow-sm)]"
                            : "hover:bg-[#edece6] text-[#4f4e4a]"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate pr-1">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? "bg-emerald-500" : "bg-[#d6d4cc]"}`}
                          />
                          <div className="flex flex-col truncate">
                            <span className="font-medium truncate text-xs">{session.title}</span>
                            <span className="text-[10px] text-[#abaaa2] truncate">
                              {formatRelativeTime(session.mtime)}
                              {session.id.endsWith(".jsonl") ? ` · ${session.id.split(/[\\/]/).pop()}` : ""}
                            </span>
                          </div>
                        </div>
                        <GitBranch className="w-3.5 h-3.5 text-[#abaaa2] shrink-0" />
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

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
