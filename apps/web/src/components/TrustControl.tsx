import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useUiStore } from "../store.ts";
import { client } from "../ws.ts";
import { cn } from "../lib/utils.ts";

export function TrustControl({ compact = false }: { compact?: boolean }) {
  const cwd = useUiStore((state) => state.cwd);
  const trust = useUiStore((state) => state.trust);
  const idle = useUiStore((state) => state.agentStatus) !== "running";
  const trusted = trust === "trusted";

  const handleTrust = async () => {
    if (!cwd || !idle) {
      return;
    }
    try {
      await client.request("workspace.trust", {
        trust: trusted ? "untrusted" : "trusted",
      });
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const label = !cwd ? "未打开" : trusted ? "已信任" : "沙箱";
  const title = !cwd
    ? "先打开工作区再切换信任"
    : !idle
      ? "等当前轮结束再改信任"
      : trusted
        ? "当前工作区已信任。bash / write 仍会询问。点此改回沙箱。"
        : "当前工作区未信任，禁止 bash / write。点此信任本仓库。";

  return (
    <button
      type="button"
      onClick={() => void handleTrust()}
      disabled={!idle || !cwd}
      title={title}
      aria-label={`工作区信任：${label}。${!cwd ? "先打开工作区。" : trusted ? "已信任，工具仍会询问。" : "沙箱模式，禁止 bash 和 write。"}`}
      aria-pressed={cwd ? trusted : undefined}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border text-[11px] transition disabled:opacity-40 disabled:hover:bg-transparent",
        compact ? "px-1.5 py-1" : "px-2 py-1",
        trusted
          ? "bg-emerald-50/80 border-emerald-200/70 text-emerald-900 hover:bg-emerald-50"
          : "bg-[#00000006] border-[#0000000a] text-[#4f4e4a] hover:bg-[#edece6]",
      )}
    >
      {trusted ? (
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
      ) : (
        <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
      )}
      <span className={cn("leading-tight text-left", compact && "hidden sm:block")}>
        <span className="block font-medium">{label}</span>
        {!compact ? (
          <span className="block text-[10px] text-current/70">
            {!cwd ? "打开后再改" : trusted ? "仍会询问工具" : "禁止 bash / write"}
          </span>
        ) : null}
      </span>
    </button>
  );
}
