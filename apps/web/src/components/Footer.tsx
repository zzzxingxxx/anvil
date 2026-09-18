import { useUiStore } from "../store.ts";
import { formatTokens } from "../lib/utils.ts";
import { UsageExport } from "./UsageExport.tsx";

export function Footer() {
  const { cwd, sessionId, usage, agentStatus } = useUiStore();

  return (
    <footer className="h-6.5 border-t border-[#0000000a] bg-[#faf9f5] px-3.5 flex items-center justify-between text-[11px] text-[#7e7d77] font-mono select-none shrink-0">
      <div className="flex items-center gap-2 truncate">
        <span className="truncate max-w-sm text-[#4f4e4a]">{cwd ?? "未载入项目"}</span>
        <span className="text-[#00000018]">·</span>
        <span className="text-[#7e7d77]">{sessionId ?? "sess-main"}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-[#4f4e4a]">
          <span>↑{formatTokens(usage.inputTokens)}</span>
          <span>↓{formatTokens(usage.outputTokens)}</span>
          {usage.cacheReadTokens ? <span>cache↓{formatTokens(usage.cacheReadTokens)}</span> : null}
          {usage.cacheWriteTokens ? <span>cache↑{formatTokens(usage.cacheWriteTokens)}</span> : null}
          <span>${(usage.costUsd ?? 0.00).toFixed(4)}</span>
          <UsageExport />
        </div>

        <span className="text-[#00000018]">·</span>

        <div className="flex items-center gap-1.5 font-sans">
          <span className={`w-1.5 h-1.5 rounded-full ${
            agentStatus === "running" ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
          }`} />
          <span className="text-[#4f4e4a] text-[11px]">
            {agentStatus === "running" ? "执行中" : "就绪"}
          </span>
        </div>
      </div>
    </footer>
  );
}
