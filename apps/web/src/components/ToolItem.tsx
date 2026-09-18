import { 
  Copy, 
  Check, 
  Terminal, 
  ChevronRight, 
  ChevronDown,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { ToolCard } from "../store.ts";
import { useUiStore } from "../store.ts";
import { formatElapsed } from "../lib/utils.ts";

interface ToolItemProps {
  tool: ToolCard;
}

export function ToolItem({ tool }: ToolItemProps) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const [fullOutput, setFullOutput] = useState(false);
  const truncated = !fullOutput && tool.output.length > 4000;
  const shownOutput = truncated ? `${tool.output.slice(0, 4000)}\n…` : tool.output;
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (tool.status !== "running" || !tool.startedAt) {
      return;
    }
    const handle = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(handle);
  }, [tool.status, tool.startedAt]);

  const elapsedMs =
    tool.startedAt == null
      ? null
      : (tool.endedAt ?? (tool.status === "running" ? now : tool.startedAt)) - tool.startedAt;

  const copyOutput = () => {
    void navigator.clipboard.writeText(tool.output).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      },
      (error) => {
        useUiStore.setState({
          lastError: error instanceof Error ? error.message : "复制失败",
        });
      },
    );
  };

  const command =
    typeof tool.args === "object" && tool.args && "command" in tool.args
      ? String((tool.args as { command: unknown }).command ?? "")
      : null;
  const path =
    typeof tool.args === "object" && tool.args && "path" in tool.args
      ? String((tool.args as { path: unknown }).path ?? "")
      : null;
  const summary = command || path;

  return (
    <div className="rounded-xl border border-[#00000012] bg-[#ffffff] shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden my-3.5 text-xs transition-all">
      {/* Tool Header Bar */}
      <div 
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between px-3.5 py-2.5 bg-[#fbfbfa] hover:bg-[#f7f6f2] cursor-pointer select-none border-b border-[#0000000a] transition-colors"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <button className="text-[#abaaa2] hover:text-[#4f4e4a]">
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          
          <div className="flex items-center gap-1.5 font-mono text-xs text-[#1f1e1d] font-semibold bg-[#00000006] px-2 py-0.5 rounded-md border border-[#00000008]">
            <Terminal className="w-3 h-3 text-[#7e7d77]" />
            <span>{tool.name}</span>
          </div>

          {summary ? (
            <span className="font-mono text-xs text-[#4f4e4a] truncate max-w-md bg-[#ffffff] px-2 py-0.5 rounded-md border border-[#0000000f] shadow-inner">
              {summary}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2 text-xs">
          {elapsedMs != null ? (
            <span className="font-mono text-[10px] text-[#abaaa2]">{formatElapsed(elapsedMs)}</span>
          ) : null}
          {tool.status === "running" && (
            <span className="text-amber-700 font-medium flex items-center gap-1.5 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              执行中...
            </span>
          )}
          {tool.status === "success" && (
            <span className="text-emerald-800 font-medium bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
              完成
            </span>
          )}
          {tool.status === "error" && (
            <span className="text-rose-800 font-medium bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/60">
              失败
            </span>
          )}
        </div>
      </div>

      {/* Output Content */}
      {expanded && (
        <div className="p-3 bg-[#faf9f5]/50 space-y-2.5">
          {!summary && tool.args != null ? (
            <div className="space-y-1">
              <pre className="p-2.5 rounded-lg bg-[#ffffff] font-mono text-[#4f4e4a] overflow-x-auto text-[11.5px] border border-[#0000000a]">
                {typeof tool.args === "string" ? tool.args : JSON.stringify(tool.args, null, 2)}
              </pre>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-[#7e7d77]">
              <span className="font-medium">标准执行输出</span>
              {tool.output && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyOutput();
                  }}
                  className="flex items-center gap-1 text-[#7e7d77] hover:text-[#1f1e1d] bg-[#ffffff] hover:bg-[#edece6] px-2 py-0.5 rounded border border-[#0000000a] transition"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-[#abaaa2]" />}
                  <span>{copied ? "已复制" : "复制"}</span>
                </button>
              )}
            </div>

            <pre className="p-3 rounded-lg bg-[#ffffff] font-mono text-[#1f1e1d] overflow-x-auto text-xs leading-relaxed max-h-64 border border-[#00000010] shadow-[var(--shadow-sm)]">
              {shownOutput || (
                <span className="text-[#abaaa2] italic">
                  {tool.status === "running" ? "子进程实时结果等待中…" : "没有输出。"}
                </span>
              )}
            </pre>
            {tool.output.length > 4000 ? (
              <button
                type="button"
                onClick={() => setFullOutput((value) => !value)}
                className="text-[11px] text-[#7e7d77] hover:text-[#1f1e1d]"
              >
                {fullOutput ? "收起" : "展开全部"}
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
