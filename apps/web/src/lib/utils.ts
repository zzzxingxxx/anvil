import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatTokens(tokens: number) {
  if (tokens < 1000) return tokens.toString();
  return `${(tokens / 1000).toFixed(1)}k`;
}

export function agentStatusDot(status: "idle" | "running" | "error"): string {
  if (status === "running") {
    return "bg-amber-500 animate-pulse";
  }
  if (status === "error") {
    return "bg-rose-500";
  }
  return "bg-emerald-500";
}

export function agentStatusLabel(status: "idle" | "running" | "error", kind: "footer" | "inspector" = "footer"): string {
  if (status === "running") {
    return kind === "inspector" ? "正在执行任务" : "执行中";
  }
  if (status === "error") {
    return kind === "inspector" ? "出错待处理" : "出错";
  }
  return kind === "inspector" ? "待命就绪" : "就绪";
}

export function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m${rest.toString().padStart(2, "0")}s`;
}

export type TextPart = { type: "text" | "code" | "bold"; value: string };

export function parseSafeMarkdown(text: string): TextPart[] {
  const parts: TextPart[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > last) {
      parts.push({ type: "text", value: text.slice(last, match.index) });
    }
    const token = match[0];
    if (token.startsWith("`")) {
      parts.push({ type: "code", value: token.slice(1, -1) });
    } else {
      parts.push({ type: "bold", value: token.slice(2, -2) });
    }
    last = match.index + token.length;
  }
  if (last < text.length) {
    parts.push({ type: "text", value: text.slice(last) });
  }
  return parts;
}
