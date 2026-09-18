import { SquarePen, GitBranch, Compass, FolderOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { useUiStore } from "../store.ts";
import { formatRelativeTime } from "../lib/utils.ts";
import { client } from "../ws.ts";

export function Sidebar() {
  const { sessionId, sessions, sidebarOpen, cwd, recentWorkspaces, agentStatus } = useUiStore();
  const busy = agentStatus === "running";
  const [pathDraft, setPathDraft] = useState(cwd ?? "");

  useEffect(() => {
    setPathDraft(cwd ?? "");
  }, [cwd]);

  if (!sidebarOpen) return null;

  const handleNewSession = async () => {
    try {
      await client.request("session.new", {
        title: `探索分支 #${Math.floor(Math.random() * 900 + 100)}`,
      });
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
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <aside className="w-64 border-r border-[#0000000f] bg-[#f5f4ef] flex flex-col justify-between shrink-0 select-none text-xs text-[#3c3c3a]">
      <div className="flex flex-col h-full overflow-hidden">
        <div className="p-3 border-b border-[#00000008] space-y-2">
          <label className="text-[10.5px] font-semibold text-[#7e7d77] uppercase tracking-wider px-0.5">
            打开工作区
          </label>
          <div className="flex gap-1.5">
            <input
              value={pathDraft}
              onChange={(event) => setPathDraft(event.target.value)}
              placeholder="粘贴本机目录路径"
              className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-[#00000012] bg-white text-[11px] outline-none focus:border-[#00000030]"
            />
            {typeof window !== "undefined" && window.anvilDesktop ? (
              <button
                type="button"
                onClick={() => void pickFolder()}
                className="px-2 rounded-lg border border-[#00000014] bg-white text-[#1f1e1d]"
                title="系统文件夹对话框"
              >
                选
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => handleOpen(pathDraft)}
              className="px-2 rounded-lg bg-[#1f1e1d] text-white"
              title="打开"
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
                  onClick={() => {
                    setPathDraft(item);
                    void handleOpen(item);
                  }}
                  className="w-full text-left truncate px-2 py-1 rounded-md text-[10.5px] text-[#7e7d77] hover:bg-[#edece6] hover:text-[#1f1e1d]"
                >
                  {item}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="p-3 border-b border-[#00000008]">
          <button
            onClick={handleNewSession}
            disabled={busy}
            title={busy ? "等当前轮结束再新建会话" : undefined}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#ffffff] hover:bg-[#fcfbf9] border border-[#00000012] text-[#1f1e1d] shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-all active:scale-[0.98] font-medium group disabled:opacity-40 disabled:hover:bg-[#ffffff]"
          >
            <span className="flex items-center gap-2">
              <SquarePen className="w-3.5 h-3.5 text-[#7e7d77] group-hover:text-[#1f1e1d] transition-colors" />
              <span className="text-xs">新建会话</span>
            </span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-5">
          <div>
            <div className="px-2 pb-1.5 text-[10.5px] font-semibold text-[#7e7d77] uppercase tracking-wider flex items-center justify-between">
              <span>会话</span>
              <span className="text-[9px] px-1.5 rounded-full bg-[#0000000a] text-[#7e7d77] font-mono">
                {sessions.length}
              </span>
            </div>
            <div className="space-y-1">
              {sessions.length === 0 ? (
                <div className="px-2 py-2 text-[11px] text-[#abaaa2]">还没有会话。打开工作区后新建一条。</div>
              ) : (
                sessions.map((session) => {
                  const active = session.id === sessionId;
                  return (
                    <button
                      key={session.id}
                      type="button"
                      disabled={busy && !active}
                      title={busy && !active ? "等当前轮结束再切换会话" : undefined}
                      onClick={() => handleResume(session.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left disabled:opacity-40 ${
                        active
                          ? "bg-[#ffffff] border border-[#00000018] text-[#1f1e1d]"
                          : "hover:bg-[#edece6] text-[#4f4e4a]"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-1">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? "bg-emerald-500" : "bg-[#d6d4cc]"}`} />
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
  );
}
