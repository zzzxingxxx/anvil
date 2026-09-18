import {
  X,
  ShieldCheck,
  ShieldAlert,
  Coins,
  Activity,
} from "lucide-react";
import { useUiStore } from "../store.ts";
import { agentStatusDot, agentStatusLabel, formatTokens } from "../lib/utils.ts";
import { FileTree } from "./FileTree.tsx";
import { SessionTree } from "./SessionTree.tsx";
import { DiffPanel } from "./DiffPanel.tsx";
import { ArtifactPanel } from "./ArtifactPanel.tsx";
import { client } from "../ws.ts";

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

  if (!inspectorOpen) return null;

  const successTools = tools.filter((t) => t.status === "success").length;

  return (
    <>
      <button
        type="button"
        className="fixed inset-x-0 top-12 bottom-7 z-20 bg-[#1f1e1d]/20 backdrop-blur-[1px] xl:hidden"
        aria-label="关闭检查器"
        onClick={toggleInspector}
      />
      <aside className="fixed top-12 bottom-7 right-0 z-30 w-[min(20rem,90vw)] xl:static xl:inset-auto xl:z-auto xl:w-72 xl:h-full border-l border-[var(--border-subtle)] bg-[#f5f4ef] flex flex-col justify-between shrink-0 select-none text-xs text-[#4f4e4a]">
        <div className="flex flex-col h-full overflow-hidden">
          <div className="h-12 px-3.5 border-b border-[#0000000a] flex items-center justify-between bg-[#faf9f5]">
            <div className="flex items-center gap-1.5 font-medium text-xs text-[#1f1e1d]">
              <Activity className="w-3.5 h-3.5 text-[#7e7d77]" />
              <span>检查器</span>
            </div>
            <button
              type="button"
              onClick={toggleInspector}
              aria-label="关闭检查器"
              className="p-1 rounded-md text-[#7e7d77] hover:text-[#1f1e1d] hover:bg-[#edece6] transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain p-3.5 space-y-4">
            <section className="space-y-1.5">
              <span className="text-[10.5px] font-semibold text-[#7e7d77] uppercase tracking-wider">
                Agent 状态
              </span>

              <div className="rounded-xl border border-[#00000010] bg-[#ffffff] p-3 space-y-2.5 shadow-[var(--shadow-card)]">
                <div className="flex items-center justify-between">
                  <span className="text-[#7e7d77]">生命周期</span>
                  <span className="flex items-center gap-1.5 font-medium text-[#1f1e1d]">
                    <span className={`w-1.5 h-1.5 rounded-full ${agentStatusDot(agentStatus)}`} />
                    <span>{agentStatusLabel(agentStatus, "inspector")}</span>
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#7e7d77]">沙箱</span>
                  <span className="flex items-center gap-1 text-[#1f1e1d] font-medium">
                    {trust === "trusted" ? (
                      <>
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        <span>已信任 · 仍询问</span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-3 h-3 text-amber-600" />
                        <span>未信任</span>
                      </>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#7e7d77] shrink-0">模型</span>
                  <span className="font-mono text-[#1f1e1d] text-[11px] truncate max-w-[140px]" title={modelLabel ?? ""}>
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

            <section className="space-y-1.5">
              <span className="text-[10.5px] font-semibold text-[#7e7d77] uppercase tracking-wider flex items-center gap-1">
                <Coins className="w-3 h-3 text-[#7e7d77]" />
                <span>用量</span>
              </span>

              <div className="rounded-xl border border-[#00000010] bg-[#ffffff] p-3 space-y-2.5 shadow-[var(--shadow-card)]">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-[#f8f7f2] border border-[#00000008]">
                    <span className="text-[10px] text-[#7e7d77]">输入</span>
                    <div className="font-mono font-semibold text-[#1f1e1d] text-xs mt-0.5">
                      {formatTokens(usage.inputTokens)}
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-[#f8f7f2] border border-[#00000008]">
                    <span className="text-[10px] text-[#7e7d77]">输出</span>
                    <div className="font-mono font-semibold text-[#1f1e1d] text-xs mt-0.5">
                      {formatTokens(usage.outputTokens)}
                    </div>
                  </div>
                </div>

                {usage.cacheReadTokens || usage.cacheWriteTokens ? (
                  <div className="flex items-center justify-between text-[11px] text-[#7e7d77]">
                    <span>Cache</span>
                    <span className="font-mono text-[#1f1e1d]">
                      ↓{formatTokens(usage.cacheReadTokens ?? 0)} ↑{formatTokens(usage.cacheWriteTokens ?? 0)}
                    </span>
                  </div>
                ) : null}

                <div className="flex items-center justify-between pt-0.5 text-[11px] text-[#7e7d77]">
                  <span>估算成本</span>
                  <span className="font-mono font-semibold text-[#1f1e1d]">
                    ${(usage.costUsd ?? 0.0).toFixed(4)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#7e7d77]">
                  <span>子任务</span>
                  <span className="font-mono text-[#1f1e1d]">
                    ${tasks.reduce((sum, task) => sum + (task.costUsd ?? 0), 0).toFixed(4)}
                  </span>
                </div>
              </div>
            </section>

            <section className="space-y-1.5">
              <span className="text-[10.5px] font-semibold text-[#7e7d77] uppercase tracking-wider">工具</span>

              <div className="rounded-xl border border-[#00000010] bg-[#ffffff] p-3 space-y-2 shadow-[var(--shadow-card)]">
                <div className="flex items-center justify-between">
                  <span className="text-[#7e7d77]">累计调用</span>
                  <span className="font-semibold text-[#1f1e1d]">{tools.length} 次</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#7e7d77]">成功</span>
                  <span className="font-semibold text-emerald-700">{successTools} 次</span>
                </div>
                {tasks.find((task) => task.error) ? (
                  <div className="text-[11px] text-amber-800 leading-relaxed">
                    最近失败：{tasks.find((task) => task.error)?.error}
                  </div>
                ) : null}
              </div>
            </section>

            <section className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-semibold text-[#7e7d77] uppercase tracking-wider">会话树</span>
                <button
                  type="button"
                  disabled={agentStatus === "running"}
                  title={agentStatus === "running" ? "等当前轮结束再压缩" : undefined}
                  className="text-[10px] text-[#7e7d77] hover:text-[#1f1e1d] disabled:opacity-40"
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
                  压缩
                </button>
              </div>
              <div className="rounded-xl border border-[#00000010] bg-[#ffffff] p-3 shadow-[var(--shadow-card)]">
                <SessionTree />
              </div>
            </section>

            <section className="space-y-1.5">
              <span className="text-[10.5px] font-semibold text-[#7e7d77] uppercase tracking-wider">本轮 Diff</span>
              <div className="rounded-xl border border-[#00000010] bg-[#ffffff] p-3 shadow-[var(--shadow-card)]">
                <DiffPanel />
              </div>
            </section>

            <section className="space-y-1.5">
              <span className="text-[10.5px] font-semibold text-[#7e7d77] uppercase tracking-wider">制品</span>
              <div className="rounded-xl border border-[#00000010] bg-[#ffffff] p-3 shadow-[var(--shadow-card)]">
                <ArtifactPanel />
              </div>
            </section>

            <section className="space-y-1.5">
              <span className="text-[10.5px] font-semibold text-[#7e7d77] uppercase tracking-wider">文件树</span>
              <div className="rounded-xl border border-[#00000010] bg-[#ffffff] p-3 shadow-[var(--shadow-card)]">
                <FileTree />
              </div>
            </section>
          </div>
        </div>
      </aside>
    </>
  );
}
