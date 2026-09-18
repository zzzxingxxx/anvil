import { useUiStore } from "../store.ts";
import { agentStatusDot, agentStatusLabel, formatTokens } from "../lib/utils.ts";
import { UsageExport } from "./UsageExport.tsx";

export function Footer() {
  const { cwd, sessionId, usage, agentStatus, connection } = useUiStore();

  return (
    <footer className="h-7 border-t border-[#0000000a] bg-[#faf9f5] px-3.5 flex items-center justify-between text-[11px] text-[#7e7d77] font-mono select-none shrink-0 gap-3">
      <div className="flex items-center gap-2 truncate min-w-0">
        <span className="truncate max-w-[40vw] text-[#4f4e4a]">{cwd ?? "未载入项目"}</span>
        <span className="text-[#00000018] hidden sm:inline">·</span>
        <span className="text-[#7e7d77] hidden sm:inline truncate">{sessionId ?? "sess-main"}</span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden md:flex items-center gap-2 text-[#4f4e4a]">
          <span>↑{formatTokens(usage.inputTokens)}</span>
          <span>↓{formatTokens(usage.outputTokens)}</span>
          {usage.cacheReadTokens ? <span>cache↓{formatTokens(usage.cacheReadTokens)}</span> : null}
          {usage.cacheWriteTokens ? <span>cache↑{formatTokens(usage.cacheWriteTokens)}</span> : null}
          <span>${(usage.costUsd ?? 0.0).toFixed(4)}</span>
          <UsageExport />
        </div>

        <span className="text-[#00000018] hidden md:inline">·</span>

        <div className="flex items-center gap-1.5 font-sans">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              connection !== "open" ? "bg-stone-300" : agentStatusDot(agentStatus)
            }`}
          />
          <span className="text-[#4f4e4a] text-[11px]">
            {connection === "connecting"
              ? "连接中"
              : connection === "closed"
                ? "离线"
                : agentStatusLabel(agentStatus)}
          </span>
        </div>
      </div>
    </footer>
  );
}
