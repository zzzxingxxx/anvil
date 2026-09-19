export type McpRecipe = {
  id: string;
  name: string;
  command: string;
  args: string[];
  hint: string;
};

export const MCP_RECIPES: McpRecipe[] = [
  {
    id: "filesystem",
    name: "filesystem",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
    hint: "本机文件",
  },
  {
    id: "github",
    name: "github",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    hint: "GitHub",
  },
  {
    id: "memory",
    name: "memory",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
    hint: "记忆",
  },
  {
    id: "fetch",
    name: "fetch",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-fetch"],
    hint: "网页",
  },
];

export function resolveMcpIntent(text: string, cwd?: string | null): McpRecipe {
  const raw = text.trim();
  if (!raw) {
    throw new Error("请用一句话说要加什么，例如「GitHub」或「本机文件」");
  }

  const parsed = parseCommandLine(raw);
  if (parsed) {
    return {
      id: slugify(parsed.name) || `mcp-${Date.now().toString(36)}`,
      name: parsed.name,
      command: parsed.command,
      args: parsed.args,
      hint: "自定义命令",
    };
  }

  const lower = raw.toLowerCase();
  const hit =
    matchRecipe(lower, ["filesystem", "file", "文件", "目录", "本地文件", "本机文件"]) ??
    matchRecipe(lower, ["github", "gh"]) ??
    matchRecipe(lower, ["memory", "记忆", "memo"]) ??
    matchRecipe(lower, ["fetch", "网页", "http", "url"]);

  if (hit) {
    if (hit.id === "filesystem") {
      return {
        ...hit,
        args: ["-y", "@modelcontextprotocol/server-filesystem", cwd?.trim() || "."],
      };
    }
    return { ...hit };
  }

  throw new Error(`还不认识「${raw}」。可以说 GitHub、本机文件、记忆、网页，或直接贴 npx 启动命令。`);
}

export function draftSkillFromPrompt(prompt: string): { name: string; description: string; body: string } {
  const text = prompt.trim();
  if (!text) {
    throw new Error("请用一句话说这个 Skill 做什么");
  }
  const name = skillNameFrom(text);
  const description = text.split(/[。.!?\n]/)[0]?.trim().slice(0, 200) || text.slice(0, 200);
  const body = [
    text,
    "",
    "先读相关文件或 diff，再按上面的目标给出可执行步骤。不要编造仓库里没有的内容。",
  ].join("\n");
  return { name, description, body };
}

function matchRecipe(lower: string, needles: string[]): McpRecipe | undefined {
  const key = needles[0];
  if (!key) return undefined;
  if (!needles.some((item) => lower.includes(item))) {
    return undefined;
  }
  return MCP_RECIPES.find((item) => item.id === key);
}

function parseCommandLine(raw: string): { name: string; command: string; args: string[] } | null {
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return null;
  }
  const looksLikeCommand = /^(npx|npm|pnpm|bunx|node|python|py|uvx|cmd|cmd.exe)$/i.test(parts[0] ?? "");
  if (!looksLikeCommand && !parts[0]?.includes("/") && !parts[0]?.includes("\\")) {
    return null;
  }
  const command = parts[0]!;
  const args = parts.slice(1);
  const pkg = args.find((item) => item.startsWith("@") || item.includes("server-")) ?? command;
  const name = slugify(pkg.replace(/^@.*\//, "").replace(/^server-/, "")) || "mcp";
  return { name, command, args };
}

function skillNameFrom(text: string): string {
  const lower = text.toLowerCase();
  if (/审查|review|diff/.test(lower)) return "review-diff";
  if (/pr|pull request|提交说明/.test(lower)) return "write-pr";
  if (/测试|test/.test(lower)) return "write-tests";
  if (/提交|commit/.test(lower)) return "write-commit";
  const slug = slugify(text);
  if (slug.length >= 2) {
    return slug.slice(0, 32);
  }
  return `skill-${Date.now().toString(36).slice(-6)}`;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
