import { useUiStore } from "../store.ts";
import { agentStatusDot, agentStatusLabel, formatTokens } from "../lib/utils.ts";
import { UsageExport } from "./UsageExport.tsx";
import { Terminal, HardDrive } from "lucide-react";

export function Footer() {
  const { cwd, sessionId, usage, agentStatus, connection } = useUiStore();

  const folderName = cwd ? cwd.split(/[\\/]/).filter(Boolean).pop() || cwd : null;

  return (
    <footer className="h-7 border-t border-[var(--border-subtle)] bg-[#faf9f5] px-4 flex items-center justify-between text-[11px] text-[#7e7d77] font-mono select-none shrink-0 gap-3">
      <div className="flex items-center gap-2 truncate min-w-0">
        <div className="flex items-center gap-1.5 truncate text-[#4f4e4a]">
          <HardDrive className="w-3 h-3 text-[#abaaa2] shrink-0" />
          <span className="truncate max-w-[28vw] font-medium" title={cwd ?? "未载入项目"}>
            {folderName ?? "未载入项目"}
          </span>
        </div>
        <span className="text-[#00000014] hidden sm:inline">/</span>
        <span className="text-[#abaaa2] hidden sm:inline truncate max-w-[20vw]" title={sessionId ?? "main"}>
          {sessionId ? sessionId.split(/[\\/]/).pop() : "main"}
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden md:flex items-center gap-2.5 text-[#4f4e4a]">
          <span title="输入 Token">↑{formatTokens(usage.inputTokens)}</span>
          <span title="输出 Token">↓{formatTokens(usage.outputTokens)}</span>
          {usage.cacheReadTokens ? (
            <span title="缓存读取" className="text-[#7e7d77]">
              c↓{formatTokens(usage.cacheReadTokens)}
            </span>
          ) : null}
          <span className="font-semibold text-[#1f1e1d]" title="估算花费">
            ${(usage.costUsd ?? 0.0).toFixed(4)}
          </span>
          <UsageExport />
        </div>

        <span className="text-[#00000014] hidden md:inline">·</span>

        <div className="flex items-center gap-1.5 font-sans">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              connection !== "open" ? "bg-stone-300" : agentStatusDot(agentStatus)
            }`}
          />
          <span className="text-[#4f4e4a] text-[11px] font-medium">
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
