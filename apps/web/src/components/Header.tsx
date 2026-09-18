import {
  Sidebar as SidebarIcon,
  FolderGit2,
  Search,
  SlidersHorizontal,
  GitBranch,
  Menu,
  MessageSquare,
  LayoutGrid,
  Settings2,
} from "lucide-react";
import { useUiStore } from "../store.ts";
import { ModelSelector } from "./ModelSelector.tsx";
import { TrustControl } from "./TrustControl.tsx";
import { cn } from "../lib/utils.ts";

const TABS = [
  { id: "chat", label: "对话", icon: MessageSquare },
  { id: "board", label: "看板", icon: LayoutGrid },
  { id: "settings", label: "设置", icon: Settings2 },
] as const;

export function Header() {
  const {
    connection,
    cwd,
    sessionTitle,
    sidebarOpen,
    toggleSidebar,
    inspectorOpen,
    toggleInspector,
    adapter,
    setActiveTab,
    activeTab,
  } = useUiStore();

  return (
    <header className="h-12 border-b border-[var(--border-subtle)] bg-[#faf9f5]/90 backdrop-blur-md px-2 sm:px-3.5 flex items-center justify-between gap-2 select-none shrink-0 z-20">
      <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
        <button
          type="button"
          onClick={toggleSidebar}
          title={sidebarOpen ? "隐藏侧边栏" : "显示侧边栏"}
          aria-label={sidebarOpen ? "隐藏侧边栏" : "显示侧边栏"}
          aria-pressed={sidebarOpen}
          className={cn(
            "p-1.5 rounded-lg text-[#7e7d77] hover:text-[#1f1e1d] hover:bg-[#edece6]/70 transition active:scale-95 lg:inline-flex",
            !sidebarOpen ? "bg-[#edece6]/70 text-[#1f1e1d]" : "",
            "hidden sm:inline-flex",
          )}
        >
          <SidebarIcon className="w-4 h-4 stroke-[1.8]" />
        </button>
        <button
          type="button"
          onClick={toggleSidebar}
          title={sidebarOpen ? "隐藏侧边栏" : "显示侧边栏"}
          aria-label={sidebarOpen ? "隐藏侧边栏" : "显示侧边栏"}
          className="p-1.5 rounded-lg text-[#7e7d77] hover:text-[#1f1e1d] hover:bg-[#edece6]/70 sm:hidden"
        >
          <Menu className="w-4 h-4 stroke-[1.8]" />
        </button>

        <div className="flex items-center gap-2 text-xs min-w-0">
          <div className="flex items-center gap-1.5 font-semibold text-[#1f1e1d] tracking-tight shrink-0">
            <span>Anvil</span>
            {adapter === "fake" ? (
              <span className="text-[10px] font-medium text-[#7e7d77] bg-[#edece6] px-1.5 py-0.5 rounded">
                假循环
              </span>
            ) : null}
            {adapter === "sdk" ? (
              <span className="hidden sm:inline text-[10px] font-medium text-[#7e7d77] bg-[#edece6] px-1.5 py-0.5 rounded">
                SDK
              </span>
            ) : null}
            {adapter === "rpc" ? (
              <span
                className="text-[10px] font-medium text-[#7e7d77] bg-[#edece6] px-1.5 py-0.5 rounded"
                title="RPC sidecar 不走 Anvil 闸门；bash/write 由本机 pi 策略决定"
              >
                RPC
              </span>
            ) : null}
          </div>

          <span className="text-[#0000001f] font-light hidden md:inline">/</span>

          <div className="hidden md:flex items-center gap-1.5 text-[#4f4e4a] px-1.5 py-0.5 rounded min-w-0">
            <FolderGit2 className="w-3.5 h-3.5 text-[#7e7d77] shrink-0" />
            <span className="font-medium truncate max-w-[160px] lg:max-w-[220px]">
              {cwd ? cwd.split(/[\\/]/).pop() || cwd : "未打开工程"}
            </span>
          </div>

          <span className="text-[#0000001f] font-light hidden lg:inline">/</span>

          <div className="hidden lg:flex items-center gap-1 text-[#7e7d77] font-mono text-[11px] bg-[#00000008] px-1.5 py-0.5 rounded border border-[#0000000a] min-w-0">
            <GitBranch className="w-3 h-3 text-[#7e7d77] shrink-0" />
            <span className="truncate max-w-[130px]">{sessionTitle ?? "main"}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0 overflow-x-auto [scrollbar-width:none]">
        <TrustControl compact />
        <ModelSelector compact />

        <div
          className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-[#7e7d77] bg-[#00000005]"
          title={connection === "open" ? "已连接 Host" : connection === "connecting" ? "正在连接 Host" : "Host 离线"}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              connection === "open"
                ? "bg-emerald-500 ring-2 ring-emerald-500/20"
                : connection === "connecting"
                  ? "bg-amber-500 animate-pulse"
                  : "bg-stone-300"
            }`}
          />
          <span className="hidden md:inline">
            {connection === "open" ? "就绪" : connection === "connecting" ? "连接中" : "离线"}
          </span>
        </div>

        <nav className="flex items-center gap-0.5 text-[11px] p-0.5 rounded-lg bg-[#00000006]" aria-label="工作区视图">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-current={selected ? "page" : undefined}
                aria-label={tab.label}
                title={tab.label}
                className={cn(
                  "flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-md transition",
                  selected ? "bg-[#1f1e1d] text-white shadow-[var(--shadow-sm)]" : "text-[#7e7d77] hover:bg-[#edece6]",
                )}
              >
                <Icon className="w-3 h-3" />
                <span className="hidden md:inline">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          title="命令面板 Ctrl+K"
          aria-label="打开命令面板"
          onClick={() => useUiStore.getState().setCommandOpen(true, "search")}
          className="flex items-center gap-1.5 px-1.5 sm:px-2 py-0.5 rounded-md bg-[#00000006] border border-[#0000000a] text-[#4f4e4a] text-[11px] hover:bg-[#edece6]"
        >
          <Search className="w-3 h-3" />
          <span className="hidden lg:inline">Ctrl+K</span>
        </button>

        <button
          type="button"
          onClick={toggleInspector}
          title={inspectorOpen ? "隐藏检查器" : "显示检查器"}
          aria-label={inspectorOpen ? "隐藏检查器" : "显示检查器"}
          aria-pressed={inspectorOpen}
          className={cn(
            "p-1.5 rounded-lg transition active:scale-95",
            inspectorOpen
              ? "bg-[#1f1e1d] text-[#ffffff] shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
              : "text-[#7e7d77] hover:text-[#1f1e1d] hover:bg-[#edece6]/70",
          )}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 stroke-[2]" />
        </button>
      </div>
    </header>
  );
}
