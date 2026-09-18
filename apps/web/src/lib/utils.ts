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

export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const delta = Math.max(0, now - timestamp);
  if (delta < 60_000) {
    return "刚刚";
  }
  if (delta < 3_600_000) {
    return `${Math.floor(delta / 60_000)} 分钟前`;
  }
  if (delta < 86_400_000) {
    return `${Math.floor(delta / 3_600_000)} 小时前`;
  }
  if (delta < 7 * 86_400_000) {
    return `${Math.floor(delta / 86_400_000)} 天前`;
  }
  return new Date(timestamp).toLocaleDateString("zh-CN");
}

export function isSafeHref(href: string): boolean {
  return /^https?:\/\//i.test(href.trim());
}

export type TextPart = { type: "text" | "code" | "bold" | "italic" | "link"; value: string; href?: string };

export function parseSafeMarkdown(text: string): TextPart[] {
  const parts: TextPart[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|https?:\/\/[^\s<]+)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > last) {
      parts.push({ type: "text", value: text.slice(last, match.index) });
    }
    const token = match[0];
    if (token.startsWith("`")) {
      parts.push({ type: "code", value: token.slice(1, -1) });
    } else if (token.startsWith("**")) {
      parts.push({ type: "bold", value: token.slice(2, -2) });
    } else if (token.startsWith("http://") || token.startsWith("https://")) {
      const href = token.replace(/[),.;!?]+$/, "");
      if (isSafeHref(href)) {
        parts.push({ type: "link", value: href, href });
      } else {
        parts.push({ type: "text", value: href });
      }
      if (href.length < token.length) {
        parts.push({ type: "text", value: token.slice(href.length) });
      }
    } else {
      parts.push({ type: "italic", value: token.slice(1, -1) });
    }
    last = match.index + token.length;
  }
  if (last < text.length) {
    parts.push({ type: "text", value: text.slice(last) });
  }
  return parts;
}
