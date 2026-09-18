import { useState } from "react";
import {
  FolderOpen,
  FolderTree,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Code2,
  GitBranch,
  ShieldCheck,
  ShieldAlert,
  LoaderCircle,
  History,
} from "lucide-react";
import { useUiStore } from "../store.ts";
import { client } from "../ws.ts";
import { openWorkspace, pickAndOpenWorkspace } from "../lib/workspace.ts";

export function WorkspaceWelcome({ onSelectPrompt }: { onSelectPrompt?: (prompt: string) => void }) {
  const { cwd, recentWorkspaces, trust, sessions, agentStatus } = useUiStore();
  const busy = agentStatus === "running";
  const [picking, setPicking] = useState(false);
  const [manualPath, setManualPath] = useState("");
  const [showManual, setShowManual] = useState(false);

  const folderName = cwd ? cwd.split(/[\\/]/).filter(Boolean).pop() || cwd : null;

  const handlePick = async () => {
    if (busy || picking) return;
    setPicking(true);
    try {
      await pickAndOpenWorkspace();
    } finally {
      setPicking(false);
    }
  };

  const handleManualOpen = async () => {
    const trimmed = manualPath.trim();
    if (!trimmed) return;
    await openWorkspace(trimmed);
  };

  if (!cwd) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center max-w-xl mx-auto px-4 py-8 select-none text-center">
        {/* 品牌与标题 */}
        <div className="w-12 h-12 rounded-2xl bg-white border border-[#00000010] shadow-[var(--shadow-card)] flex items-center justify-center mb-4 text-[#1f1e1d]">
          <span className="font-serif font-bold text-2xl tracking-tight">π</span>
        </div>
        <h2 className="text-lg font-semibold text-[#1f1e1d] mb-1.5 tracking-tight">
          欢迎使用 Anvil 工作台
        </h2>
        <p className="text-xs text-[#7e7d77] max-w-sm mb-6 leading-relaxed">
          基于 Pi 微内核的自研 AI Agent 工作台。请先选择一个本地工程目录开始探索与协作。
        </p>

        {/* 核心主操作：一键调起系统选择框 */}
        <div className="w-full max-w-md bg-white border border-[#00000012] rounded-2xl p-5 shadow-[var(--shadow-card)] text-left space-y-4">
          <div>
            <div className="text-xs font-semibold text-[#1f1e1d] mb-1">选择工作区工程</div>
            <div className="text-[11px] text-[#7e7d77]">
              点击下方按钮直接调出本机系统目录选择器，无需手动复制粘贴路径。
            </div>
          </div>

          <button
            type="button"
            disabled={busy || picking}
            onClick={handlePick}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-[#1f1e1d] text-white text-xs font-medium shadow-[var(--shadow-sm)] hover:bg-[#343230] transition-all active:scale-[0.99] disabled:opacity-50 group"
          >
            {picking ? (
              <LoaderCircle className="w-4 h-4 animate-spin" />
            ) : (
              <FolderOpen className="w-4 h-4 text-[#dedcd5] group-hover:scale-105 transition-transform" />
            )}
            <span>{picking ? "正在等待系统选择框…" : "选择本地工程目录"}</span>
          </button>

          {/* 手动输入备选 */}
          {!showManual ? (
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setShowManual(true)}
                className="text-[11px] text-[#abaaa2] hover:text-[#7e7d77] transition-colors"
              >
                或手动输入本地绝对路径 →
              </button>
            </div>
          ) : (
            <div className="pt-2 border-t border-[#0000000a] space-y-2">
              <div className="text-[10.5px] text-[#7e7d77]">手动绝对路径</div>
              <div className="flex gap-2">
                <input
                  value={manualPath}
                  onChange={(e) => setManualPath(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleManualOpen();
                    }
                  }}
                  placeholder="如 F:\projects\my-app"
                  className="flex-1 px-3 py-2 rounded-lg border border-[#00000012] bg-[#faf9f5] text-xs outline-none focus:border-[#00000030] focus:bg-white transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={handleManualOpen}
                  disabled={!manualPath.trim()}
                  className="px-3 py-2 rounded-lg bg-[#edece6] hover:bg-[#e0ded6] text-[#1f1e1d] text-xs font-medium disabled:opacity-40 transition-colors"
                >
                  打开
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 最近工程卡片 */}
        {recentWorkspaces.length > 0 ? (
          <div className="w-full max-w-md mt-5 text-left space-y-2">
            <div className="text-[11px] font-semibold text-[#7e7d77] uppercase tracking-wider px-1">
              最近打开的工程
            </div>
            <div className="grid gap-1.5">
              {recentWorkspaces.slice(0, 3).map((path) => {
                const name = path.split(/[\\/]/).filter(Boolean).pop() || path;
                return (
                  <button
                    key={path}
                    type="button"
                    disabled={busy}
                    onClick={() => openWorkspace(path)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#0000000c] hover:border-[#00000018] shadow-[var(--shadow-sm)] hover:bg-[#fcfbf9] transition-all text-left group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div className="w-7 h-7 rounded-lg bg-[#faf9f5] border border-[#0000000a] flex items-center justify-center shrink-0 text-[#7e7d77] group-hover:text-[#1f1e1d]">
                        <FolderTree className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-[#1f1e1d] truncate group-hover:text-black">
                          {name}
                        </div>
                        <div className="text-[10px] text-[#abaaa2] truncate font-mono">
                          {path}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[#abaaa2] group-hover:text-[#1f1e1d] group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  // 已打开工程但当前会话为空时的灵感启动板
  return (
    <div className="flex-1 flex flex-col items-center justify-center max-w-xl mx-auto px-4 py-8 select-none">
      {/* 工程概览条 */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#00000010] shadow-[var(--shadow-sm)] mb-4 text-xs text-[#4f4e4a]">
        <FolderTree className="w-3.5 h-3.5 text-[#7e7d77]" />
        <span className="font-semibold text-[#1f1e1d]">{folderName}</span>
        <span className="text-[#abaaa2]">·</span>
        <span className="text-[#7e7d77] font-mono text-[11px] truncate max-w-[180px]" title={cwd}>
          {cwd}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={handlePick}
          className="text-[11px] font-medium text-[#1f1e1d] hover:underline ml-1"
          title="切换工程"
        >
          更换
        </button>
      </div>

      <h2 className="text-base font-semibold text-[#1f1e1d] mb-1 tracking-tight">
        准备就绪，可以向 Agent 提问
      </h2>
      <p className="text-xs text-[#7e7d77] mb-6 text-center">
        在底部输入框输入需求，或者直接从下方快捷卡片开始探索。
      </p>

      {/* 灵感卡片网格 */}
      <div className="w-full grid gap-2.5 text-left">
        <button
          type="button"
          onClick={() =>
            onSelectPrompt?.("梳理当前工程的整体架构和模块划分，说明关键代码文件的职责，不要修改任何文件。")
          }
          className="p-3 rounded-xl bg-white border border-[#0000000c] hover:border-[#00000018] shadow-[var(--shadow-sm)] hover:bg-[#fcfbf9] transition-all flex items-start gap-3 group text-left"
        >
          <div className="w-8 h-8 rounded-lg bg-[#faf9f5] border border-[#0000000a] flex items-center justify-center shrink-0 text-[#1f1e1d] group-hover:scale-105 transition-transform">
            <Code2 className="w-4 h-4 text-[#5e5c54]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-[#1f1e1d] group-hover:text-black mb-0.5 flex items-center justify-between">
              <span>梳理当前工程架构</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#abaaa2] group-hover:text-[#1f1e1d] group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="text-[11px] text-[#7e7d77] leading-relaxed">
              只读分析工程目录结构与核心模块边界，快速掌握代码全貌。
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            onSelectPrompt?.("检查当前工程中的 Git 状态与最近修改，梳理是否有未提交的变更或待办事项。")
          }
          className="p-3 rounded-xl bg-white border border-[#0000000c] hover:border-[#00000018] shadow-[var(--shadow-sm)] hover:bg-[#fcfbf9] transition-all flex items-start gap-3 group text-left"
        >
          <div className="w-8 h-8 rounded-lg bg-[#faf9f5] border border-[#0000000a] flex items-center justify-center shrink-0 text-[#1f1e1d] group-hover:scale-105 transition-transform">
            <GitBranch className="w-4 h-4 text-[#5e5c54]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-[#1f1e1d] group-hover:text-black mb-0.5 flex items-center justify-between">
              <span>检查 Git 变更与状态</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#abaaa2] group-hover:text-[#1f1e1d] group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="text-[11px] text-[#7e7d77] leading-relaxed">
              查看当前分支状态、暂存区改动以及是否有未同步的代码。
            </div>
          </div>
        </button>

        {sessions.length > 0 && sessions[0] ? (
          <button
            type="button"
            onClick={async () => {
              await client.request("session.resume", { id: sessions[0]!.id });
            }}
            className="p-3 rounded-xl bg-white border border-[#0000000c] hover:border-[#00000018] shadow-[var(--shadow-sm)] hover:bg-[#fcfbf9] transition-all flex items-start gap-3 group text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-[#faf9f5] border border-[#0000000a] flex items-center justify-center shrink-0 text-[#1f1e1d] group-hover:scale-105 transition-transform">
              <History className="w-4 h-4 text-[#5e5c54]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-[#1f1e1d] group-hover:text-black mb-0.5 flex items-center justify-between">
                <span>恢复上一条历史会话</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#abaaa2] group-hover:text-[#1f1e1d] group-hover:translate-x-0.5 transition-all" />
              </div>
              <div className="text-[11px] text-[#7e7d77] truncate">
                {sessions[0].title}
              </div>
            </div>
          </button>
        ) : null}
      </div>
    </div>
  );
}
