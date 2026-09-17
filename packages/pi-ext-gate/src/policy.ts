import type { ApprovalRequest, TrustLevel } from "@anvil/protocol";

export type GateDecision = "allow" | "deny" | "ask";

export type GateInput = {
  toolName: string;
  args: unknown;
  trust: TrustLevel;
  cwd?: string | null;
  protectedPaths?: string[];
  bashPolicy?: "ask" | "allowlist";
  bashAllowlist?: string[];
};

const WRITE_TOOLS = new Set(["write", "edit", "bash", "powershell"]);
const ALWAYS_ASK_PATTERNS = [
  /\brm\s+-rf\b/i,
  /\bgit\s+push\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bdel\s+\/s\b/i,
  /\bRemove-Item\b/i,
];

export function previewArgs(args: unknown, max = 280): string {
  if (typeof args === "string") {
    return clip(args, max);
  }
  if (args && typeof args === "object" && "command" in args) {
    return clip(String((args as { command: unknown }).command ?? ""), max);
  }
  if (args && typeof args === "object" && "path" in args) {
    return clip(String((args as { path: unknown }).path ?? ""), max);
  }
  try {
    return clip(JSON.stringify(args), max);
  } catch {
    return "";
  }
}

export function riskFor(toolName: string, args: unknown): ApprovalRequest["risk"] {
  const preview = previewArgs(args).toLowerCase();
  if (ALWAYS_ASK_PATTERNS.some((pattern) => pattern.test(preview))) {
    return "high";
  }
  if (WRITE_TOOLS.has(toolName)) {
    return toolName === "bash" || toolName === "powershell" ? "high" : "medium";
  }
  return "low";
}

export function decideGate(input: GateInput): { decision: GateDecision; reason: string } {
  const name = input.toolName.toLowerCase();
  const preview = previewArgs(input.args);
  const protectedHit = hitsProtectedPath(preview, input.cwd, input.protectedPaths);

  if (protectedHit) {
    return { decision: "deny", reason: `命中保护路径：${protectedHit}` };
  }

  if (ALWAYS_ASK_PATTERNS.some((pattern) => pattern.test(preview))) {
    if (input.trust !== "trusted") {
      return { decision: "deny", reason: "未信任仓库禁止高危命令" };
    }
    return { decision: "ask", reason: "高危命令需要人工确认" };
  }

  if (input.trust !== "trusted" && WRITE_TOOLS.has(name)) {
    return { decision: "deny", reason: "未信任仓库禁止 write / edit / bash" };
  }

  if (name === "bash" || name === "powershell") {
    if (input.bashPolicy === "allowlist") {
      const command = preview.trim();
      const allowed = (input.bashAllowlist ?? []).some((item) => command === item || command.startsWith(`${item} `));
      if (!allowed) {
        return { decision: "ask", reason: "不在 bash 白名单，需要审批" };
      }
      return { decision: "allow", reason: "白名单命令放行" };
    }
    return { decision: "ask", reason: "shell 命令默认需要审批" };
  }

  if (name === "write" || name === "edit") {
    return { decision: "ask", reason: "写文件默认需要审批" };
  }

  return { decision: "allow", reason: "只读工具放行" };
}

function hitsProtectedPath(
  preview: string,
  cwd?: string | null,
  extra: string[] = [],
): string | null {
  const needles = [
    ".env",
    "id_rsa",
    "id_ed25519",
    "auth.json",
    "credentials",
    ...extra,
  ];
  const haystack = `${preview} ${cwd ?? ""}`.toLowerCase();
  for (const needle of needles) {
    if (haystack.includes(needle.toLowerCase())) {
      return needle;
    }
  }
  return null;
}

function clip(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}…`;
}
