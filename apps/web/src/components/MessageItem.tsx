import { 
  Copy, 
  Check, 
} from "lucide-react";
import { useState } from "react";
import type { UiMessage } from "@anvil/protocol";
import { formatTime } from "../lib/utils.ts";

interface MessageItemProps {
  message: UiMessage;
}

const COLLAPSE_LINES = 24;

export function MessageItem({ message }: MessageItemProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const lines = message.text.split(/\r?\n/);
  const collapsed = !expanded && lines.length > COLLAPSE_LINES;
  const shown = collapsed ? `${lines.slice(0, COLLAPSE_LINES).join("\n")}\n…` : message.text;

  const copyContent = () => {
    navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (isSystem) {
    return (
      <div className="flex items-center justify-center my-3 select-none">
        <span className="text-xs text-[#7e7d77] bg-[#edece6]/70 px-3 py-1 rounded-full border border-[#0000000a]">
          {message.text}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1.5 my-4.5 ${isUser ? "items-end" : "items-start"}`}>
      {/* Author & Timestamp Header */}
      <div className="flex items-center gap-1.5 px-1 text-[11px] text-[#7e7d77] select-none">
        <span className="font-semibold text-[#4f4e4a]">{isUser ? "你" : "Anvil Agent"}</span>
        <span className="text-[#abaaa2]">·</span>
        <span className="text-[#abaaa2]">{formatTime(message.createdAt)}</span>
      </div>

      {/* Bubble / Container */}
      <div className="group relative max-w-2xl">
        <div
          className={`px-4.5 py-3.5 rounded-2xl text-[13.5px] leading-relaxed select-text transition-all ${
            isUser
              ? "bg-[#e8e7e1] text-[#1f1e1d] font-normal"
              : "bg-[#ffffff] text-[#1f1e1d] border border-[#00000010] shadow-[0_1px_4px_rgba(0,0,0,0.03)]"
          }`}
        >
          <div className="whitespace-pre-wrap">
            {shown}
            {message.streaming && <span className="streaming-dot" />}
          </div>
          {lines.length > COLLAPSE_LINES ? (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="mt-2 text-[11px] text-[#7e7d77] hover:text-[#1f1e1d]"
            >
              {expanded ? "收起" : "展开全部"}
            </button>
          ) : null}
        </div>

        {/* Copy Trigger */}
        {!message.streaming && (
          <button
            onClick={copyContent}
            className={`absolute top-2.5 ${
              isUser ? "-left-7" : "-right-7"
            } opacity-0 group-hover:opacity-100 transition p-1 text-[#abaaa2] hover:text-[#1f1e1d]`}
            title="复制"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}
