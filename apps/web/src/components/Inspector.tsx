import { useState } from "react";
import {
  X,
  ShieldCheck,
  ShieldAlert,
  Coins,
  Activity,
  FolderTree,
  GitCompare,
  History,
  Layers,
  Sparkles,
} from "lucide-react";
import { useUiStore } from "../store.ts";
import { agentStatusDot, agentStatusLabel, formatTokens } from "../lib/utils.ts";
import { FileTree } from "./FileTree.tsx";
import { SessionTree } from "./SessionTree.tsx";
import { DiffPanel } from "./DiffPanel.tsx";
import { ArtifactPanel } from "./ArtifactPanel.tsx";
import { client } from "../ws.ts";

type InspectorTab = "overview" | "files" | "diff" | "artifacts" | "tree";

const TABS: Array<{ id: InspectorTab; label: string; icon: typeof Activity }> = [
  { id: "overview", label: "概览", icon: Activity },
  { id: "files", label: "文件", icon: FolderTree },
  { id: "diff", label: "Diff", icon: GitCompare },
  { id: "artifacts", label: "快照", icon: Layers },
  { id: "tree", label: "会话树", icon: History },
];

export function Inspector() {
  const {
    agentStatus,
    trust,
    tools,
    modelLabel,
    usage,
    tasks,
    inspectorOpen,
    toggleInspector,
    adapter,
  } = useUiStore();
  const [tab, setTab] = useState<InspectorTab>("overview");

  if (!inspectorOpen) return null;

  const successTools = tools.filter((t) => t.status === "success").length;

  return (
    <>
      <button
        type="button"
        className="fixed inset-x-0 top-12 bottom-7 z-20 bg-[#1f1e1d]/20 backdrop-blur-[2px] xl:hidden"
        aria-label="关闭检查器"
        onClick={toggleInspector}
      />
      <aside className="fixed top-12 bottom-7 right-0 z-30 w-[min(22rem,92vw)] xl:static xl:inset-auto xl:z-auto xl:w-80 xl:h-full border-l border-[var(--border-subtle)] bg-[#f5f4ef] flex flex-col justify-between shrink-0 select-none text-xs text-[#4f4e4a]">
        <div className="flex flex-col h-full overflow-hidden">
          {/* 顶栏 */}
          <div className="h-12 px-3.5 border-b border-[#0000000a] flex items-center justify-between bg-white/70 backdrop-blur-sm">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-[#1f1e1d]">
              <Activity className="w-3.5 h-3.5 text-[#5e5c54]" />
              <span>工作台检查器</span>
            </div>
            <button
              type="button"
              onClick={toggleInspector}
              aria-label="关闭检查器"
              className="p-1 rounded-lg text-[#7e7d77] hover:text-[#1f1e1d] hover:bg-[#edece6] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 选项卡导航 */}
          <div className="px-2 pt-2 pb-1 border-b border-[#00000008] bg-[#f5f4ef]">
            <div className="grid grid-cols-5 gap-1 p-0.5 rounded-lg bg-[#00000006]">
              {TABS.map((item) => {
                const Icon = item.icon;
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`flex flex-col items-center py-1.5 rounded-md text-[10px] font-medium transition-all ${
                      active
                        ? "bg-white text-[#1f1e1d] shadow-[var(--shadow-sm)]"
                        : "text-[#7e7d77] hover:text-[#1f1e1d]"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 mb-0.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 内容展示区 */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-3.5 space-y-4">
            {tab === "overview" ? (
              <>
                {/* Agent 状态 */}
                <section className="space-y-1.5">
                  <span className="text-[10.5px] font-semibold text-[#7e7d77] uppercase tracking-wider">
                    Agent 运行时
                  </span>

                  <div className="rounded-xl border border-[var(--border-card)] bg-white p-3 space-y-2.5 shadow-[var(--shadow-card)]">
                    <div className="flex items-center justify-between">
                      <span className="text-[#7e7d77]">生命周期</span>
                      <span className="flex items-center gap-1.5 font-medium text-[#1f1e1d]">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${agentStatusDot(agentStatus)}`}
                        />
                        <span>{agentStatusLabel(agentStatus, "inspector")}</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[#7e7d77]">沙箱模式</span>
                      <span className="flex items-center gap-1 text-[#1f1e1d] font-medium">
                        {trust === "trusted" ? (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>已信任 · 仍询问</span>
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                            <span>沙箱保护中</span>
                          </>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#7e7d77] shrink-0">当前模型</span>
                      <span
                        className="font-mono text-[#1f1e1d] text-[11px] truncate max-w-[140px]"
                        title={modelLabel ?? ""}
                      >
                        {modelLabel ?? "未选择"}
                      </span>
                    </div>

                    {adapter === "rpc" ? (
                      <div className="text-[10.5px] leading-relaxed text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
                        RPC sidecar 不走 Anvil 审批闸门。bash / write 由本机 pi 策略决定。
                      </div>
                    ) : null}
                  </div>
                </section>

                {/* Token 与开销 */}
                <section className="space-y-1.5">
                  <span className="text-[10.5px] font-semibold text-[#7e7d77] uppercase tracking-wider flex items-center gap-1">
                    <Coins className="w-3 h-3 text-[#7e7d77]" />
                    <span>Token 与用量</span>
                  </span>

                  <div className="rounded-xl border border-[var(--border-card)] bg-white p-3 space-y-2.5 shadow-[var(--shadow-card)]">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded-lg bg-[#faf9f5] border border-[#00000008]">
                        <span className="text-[10px] text-[#7e7d77]">输入 Token</span>
                        <div className="font-mono font-semibold text-[#1f1e1d] text-xs mt-0.5">
                          {formatTokens(usage.inputTokens)}
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-[#faf9f5] border border-[#00000008]">
                        <span className="text-[10px] text-[#7e7d77]">输出 Token</span>
                        <div className="font-mono font-semibold text-[#1f1e1d] text-xs mt-0.5">
                          {formatTokens(usage.outputTokens)}
                        </div>
                      </div>
                    </div>

                    {usage.cacheReadTokens || usage.cacheWriteTokens ? (
                      <div className="flex items-center justify-between text-[11px] text-[#7e7d77]">
                        <span>缓存读/写</span>
                        <span className="font-mono text-[#1f1e1d]">
                          ↓{formatTokens(usage.cacheReadTokens ?? 0)} ↑
                          {formatTokens(usage.cacheWriteTokens ?? 0)}
                        </span>
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between pt-0.5 text-[11px] text-[#7e7d77]">
                      <span>会话预估开销</span>
                      <span className="font-mono font-semibold text-[#1f1e1d]">
                        ${(usage.costUsd ?? 0.0).toFixed(4)}
                      </span>
                    </div>
                  </div>
                </section>

                {/* 工具调用统计 */}
                <section className="space-y-1.5">
                  <span className="text-[10.5px] font-semibold text-[#7e7d77] uppercase tracking-wider">
                    工具调用
                  </span>

                  <div className="rounded-xl border border-[var(--border-card)] bg-white p-3 space-y-2 shadow-[var(--shadow-card)]">
                    <div className="flex items-center justify-between">
                      <span className="text-[#7e7d77]">累计调用次数</span>
                      <span className="font-semibold text-[#1f1e1d]">{tools.length} 次</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#7e7d77]">成功执行</span>
                      <span className="font-semibold text-emerald-700">
                        {successTools} 次
                      </span>
                    </div>
                    {tasks.find((task) => task.error) ? (
                      <div className="text-[11px] text-amber-800 leading-relaxed bg-amber-50 p-2 rounded-lg">
                        最近失败：{tasks.find((task) => task.error)?.error}
                      </div>
                    ) : null}
                  </div>
                </section>
              </>
            ) : null}

            {tab === "files" ? (
              <section className="space-y-2">
                <span className="text-[10.5px] font-semibold text-[#7e7d77] uppercase tracking-wider">
                  工程文件结构
                </span>
                <div className="rounded-xl border border-[var(--border-card)] bg-white p-3 shadow-[var(--shadow-card)]">
                  <FileTree />
                </div>
              </section>
            ) : null}

            {tab === "diff" ? (
              <section className="space-y-2">
                <span className="text-[10.5px] font-semibold text-[#7e7d77] uppercase tracking-wider">
                  本轮变更 Diff
                </span>
                <div className="rounded-xl border border-[var(--border-card)] bg-white p-3 shadow-[var(--shadow-card)]">
                  <DiffPanel />
                </div>
              </section>
            ) : null}

            {tab === "artifacts" ? (
              <section className="space-y-2">
                <span className="text-[10.5px] font-semibold text-[#7e7d77] uppercase tracking-wider">
                  版本制品与快照
                </span>
                <div className="rounded-xl border border-[var(--border-card)] bg-white p-3 shadow-[var(--shadow-card)]">
                  <ArtifactPanel />
                </div>
              </section>
            ) : null}

            {tab === "tree" ? (
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-semibold text-[#7e7d77] uppercase tracking-wider">
                    分支会话树
                  </span>
                  <button
                    type="button"
                    disabled={agentStatus === "running"}
                    title={agentStatus === "running" ? "等当前轮结束再压缩" : undefined}
                    className="text-[11px] text-[#7e7d77] hover:text-[#1f1e1d] font-medium disabled:opacity-40"
                    onClick={async () => {
                      try {
                        await client.request("session.compact", {
                          instructions: "保留目标、未完成项和关键结论",
                        });
                      } catch (error) {
                        useUiStore.setState({
                          lastError: error instanceof Error ? error.message : String(error),
                        });
                      }
                    }}
                  >
                    压缩上下文
                  </button>
                </div>
                <div className="rounded-xl border border-[var(--border-card)] bg-white p-3 shadow-[var(--shadow-card)]">
                  <SessionTree />
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </aside>
    </>
  );
}
