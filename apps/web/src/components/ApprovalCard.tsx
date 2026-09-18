import { ShieldAlert, AlertTriangle, Check, X, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { useUiStore } from "../store.ts";
import { client } from "../ws.ts";
import { formatElapsed } from "../lib/utils.ts";

export function ApprovalCard() {
  const pendingApproval = useUiStore((state) => state.pendingApproval);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!pendingApproval?.expiresAt) {
      return;
    }
    const handle = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(handle);
  }, [pendingApproval?.expiresAt]);

  if (!pendingApproval) return null;

  const remainingMs = pendingApproval.expiresAt
    ? Math.max(0, pendingApproval.expiresAt - now)
    : null;

  const respond = async (decision: "allow-once" | "deny") => {
    try {
      await client.request("approval.respond", {
        requestId: pendingApproval.requestId,
        decision,
      });
      useUiStore.setState({ pendingApproval: null });
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const riskBadge =
    pendingApproval.risk === "high"
      ? "bg-rose-100 text-rose-800 border-rose-200"
      : pendingApproval.risk === "medium"
        ? "bg-amber-100 text-amber-800 border-amber-200"
        : "bg-blue-100 text-blue-800 border-blue-200";

  const riskText =
    pendingApproval.risk === "high"
      ? "高风险"
      : pendingApproval.risk === "medium"
        ? "中风险"
        : "低风险";

  return (
    <div className="w-full max-w-2xl mx-auto px-3 sm:px-4 pb-2 select-none z-10">
      <div className="rounded-2xl border border-amber-300/80 bg-[#fffdf7] p-4 shadow-[var(--shadow-card)] space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-100/70 border border-amber-200 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-[#1f1e1d]">
                  需授权执行：{pendingApproval.toolName}
                </span>
                <span
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${riskBadge}`}
                >
                  {riskText}
                </span>
              </div>
              <div className="text-[10.5px] text-[#7e7d77]">
                {pendingApproval.taskId
                  ? `来源：子任务 ${pendingApproval.taskId}`
                  : "来源：主会话对话"}
              </div>
            </div>
          </div>

          {remainingMs != null ? (
            <div className="flex items-center gap-1 text-[10.5px] font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
              <Clock className="w-3 h-3" />
              <span>
                {remainingMs === 0 ? "已超时" : `${formatElapsed(remainingMs)} 后自动拒绝`}
              </span>
            </div>
          ) : null}
        </div>

        {/* 参数预览 */}
        <div className="rounded-xl border border-[#0000000a] bg-white p-3 font-mono text-[11px] text-[#1f1e1d] whitespace-pre-wrap break-all max-h-32 overflow-y-auto leading-relaxed">
          {pendingApproval.argsPreview}
        </div>

        {/* 决策操作 */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => respond("deny")}
            disabled={remainingMs === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#00000014] bg-white hover:bg-[#faf9f5] text-xs font-medium text-[#4f4e4a] transition-all disabled:opacity-40"
          >
            <X className="w-3.5 h-3.5 text-[#7e7d77]" />
            <span>拒绝</span>
          </button>

          <button
            type="button"
            onClick={() => respond("allow-once")}
            disabled={remainingMs === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#1f1e1d] hover:bg-[#343230] text-xs font-medium text-white shadow-[var(--shadow-sm)] transition-all active:scale-[0.98] disabled:opacity-40"
          >
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>允许执行一次</span>
          </button>
        </div>
      </div>
    </div>
  );
}
