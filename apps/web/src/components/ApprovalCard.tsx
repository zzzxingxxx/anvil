import { ShieldAlert } from "lucide-react";
import { useUiStore } from "../store.ts";
import { client } from "../ws.ts";

export function ApprovalCard() {
  const pendingApproval = useUiStore((state) => state.pendingApproval);
  if (!pendingApproval) return null;

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

  const riskLabel =
    pendingApproval.risk === "high" ? "高风险" : pendingApproval.risk === "medium" ? "中风险" : "低风险";

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pb-2">
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs font-medium text-[#1f1e1d]">
              <span>需要审批：{pendingApproval.toolName}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">{riskLabel}</span>
              {pendingApproval.taskId ? (
                <span className="text-[10px] text-[#7e7d77]">子任务 {pendingApproval.taskId}</span>
              ) : null}
            </div>
            <pre className="mt-1.5 text-[11px] font-mono text-[#4f4e4a] whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
              {pendingApproval.argsPreview}
            </pre>
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => respond("allow-once")}
                className="px-3 py-1 rounded-lg bg-[#1f1e1d] text-white text-xs"
              >
                允许一次
              </button>
              <button
                type="button"
                onClick={() => respond("deny")}
                className="px-3 py-1 rounded-lg border border-[#00000014] bg-white text-xs text-[#4f4e4a]"
              >
                拒绝
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
