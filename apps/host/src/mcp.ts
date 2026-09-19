import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { McpServerConfig } from "./config.ts";
import { draftSkillFromPrompt } from "./recipes.ts";

export type McpToolInfo = { name: string; description?: string };

export type McpServerStatus = {
  id: string;
  name: string;
  command: string;
  args?: string[];
  enabled: boolean;
  status: "connected" | "disabled" | "error" | "connecting";
  error?: string;
  tools: McpToolInfo[];
  envKeys?: string[];
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

type JsonRpcMessage = {
  jsonrpc?: string;
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { message?: string; code?: number };
};

const CALL_TIMEOUT_MS = 20_000;
const INIT_TIMEOUT_MS = 12_000;

function toolName(serverId: string, name: string): string {
  const safeServer = serverId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 24) || "mcp";
  const safeTool = name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48) || "tool";
  return `mcp__${safeServer}__${safeTool}`;
}

function clip(value: string, max = 8_000): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}\n…`;
}

class McpProcess {
  readonly config: McpServerConfig;
  status: McpServerStatus["status"] = "connecting";
  error?: string;
  tools: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }> = [];
  private child: ChildProcessWithoutNullStreams | null = null;
  private buffer = Buffer.alloc(0);
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private closed = false;

  constructor(config: McpServerConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    const child = spawn(this.config.command, this.config.args ?? [], {
      env: { ...process.env, ...(this.config.env ?? {}) },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      shell: process.platform === "win32",
    });
    this.child = child;
    child.stdout.on("data", (chunk: Buffer) => this.onData(chunk));
    child.stderr.on("data", () => {
      /* ignore noisy MCP logs; errors surface via RPC or exit */
    });
    child.on("error", (error) => {
      this.fail(error instanceof Error ? error.message : String(error));
    });
    child.on("exit", (code) => {
      if (!this.closed) {
        this.fail(code == null ? "MCP 进程已退出" : `MCP 进程退出码 ${code}`);
      }
    });

    try {
      await this.request(
        "initialize",
        {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "anvil", version: "0.0.0" },
        },
        INIT_TIMEOUT_MS,
      );
      this.notify("notifications/initialized", {});
      const listed = (await this.request("tools/list", {}, INIT_TIMEOUT_MS)) as {
        tools?: Array<{ name?: string; description?: string; inputSchema?: Record<string, unknown> }>;
      };
      this.tools = (listed.tools ?? [])
        .filter((item) => typeof item.name === "string" && item.name.trim())
        .map((item) => ({
          name: String(item.name),
          description: typeof item.description === "string" ? item.description : undefined,
          inputSchema: item.inputSchema,
        }));
      this.status = "connected";
    } catch (error) {
      this.fail(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async call(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<string> {
    if (this.status !== "connected") {
      throw new Error(this.error ?? "MCP 服务器未连接");
    }
    const result = (await this.request("tools/call", { name, arguments: args }, CALL_TIMEOUT_MS, signal)) as {
      content?: Array<{ type?: string; text?: string }>;
      isError?: boolean;
    };
    const text = (result.content ?? [])
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim();
    if (result.isError) {
      throw new Error(text || "MCP 工具返回错误");
    }
    return text || "(空结果)";
  }

  snapshot(): McpServerStatus {
    return publicServerStatus({
      id: this.config.id,
      name: this.config.name,
      command: this.config.command,
      args: this.config.args,
      enabled: this.config.enabled !== false,
      status: this.status,
      error: this.error,
      tools: this.tools.map((item) => ({ name: item.name, description: item.description })),
      envKeys: envKeysOf(this.config.env),
    });
  }

  dispose(): void {
    this.closed = true;
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error("MCP 已关闭"));
      this.pending.delete(id);
    }
    const child = this.child;
    this.child = null;
    if (!child) {
      return;
    }
    child.kill();
  }

  private fail(message: string): void {
    this.status = "error";
    this.error = message;
    this.dispose();
  }

  private request(method: string, params: unknown, timeoutMs: number, signal?: AbortSignal): Promise<unknown> {
    const id = this.nextId++;
    this.write({ jsonrpc: "2.0", id, method, params });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP ${method} 超时`));
      }, timeoutMs);
      const onAbort = () => {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(new DOMException("Aborted", "AbortError"));
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      this.pending.set(id, {
        resolve: (value) => {
          signal?.removeEventListener("abort", onAbort);
          resolve(value);
        },
        reject: (error) => {
          signal?.removeEventListener("abort", onAbort);
          reject(error);
        },
        timer,
      });
    });
  }

  private notify(method: string, params: unknown): void {
    this.write({ jsonrpc: "2.0", method, params });
  }

  private write(message: JsonRpcMessage): void {
    const body = Buffer.from(`${JSON.stringify(message)}\n`, "utf8");
    const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "utf8");
    this.child?.stdin.write(Buffer.concat([header, body]));
  }

  private onData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length > 0) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd >= 0) {
        const header = this.buffer.subarray(0, headerEnd).toString("utf8");
        const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
        if (!lengthMatch) {
          this.buffer = this.buffer.subarray(headerEnd + 4);
          continue;
        }
        const length = Number(lengthMatch[1]);
        const start = headerEnd + 4;
        if (this.buffer.length < start + length) {
          return;
        }
        const body = this.buffer.subarray(start, start + length).toString("utf8");
        this.buffer = this.buffer.subarray(start + length);
        this.onMessage(body);
        continue;
      }
      const newline = this.buffer.indexOf("\n");
      if (newline < 0) {
        return;
      }
      const line = this.buffer.subarray(0, newline).toString("utf8").trim();
      this.buffer = this.buffer.subarray(newline + 1);
      if (line.startsWith("{")) {
        this.onMessage(line);
      }
    }
  }

  private onMessage(raw: string): void {
    let parsed: JsonRpcMessage;
    try {
      parsed = JSON.parse(raw) as JsonRpcMessage;
    } catch {
      return;
    }
    if (parsed.id == null) {
      return;
    }
    const pending = this.pending.get(Number(parsed.id));
    if (!pending) {
      return;
    }
    clearTimeout(pending.timer);
    this.pending.delete(Number(parsed.id));
    if (parsed.error) {
      pending.reject(new Error(parsed.error.message || "MCP 错误"));
      return;
    }
    pending.resolve(parsed.result);
  }
}

export class McpHub {
  private processes = new Map<string, McpProcess>();
  private configs: McpServerConfig[] = [];
  onAddMcp?: (text: string) => Promise<{ name: string; status: string; tools: string[] }>;
  onAddSkill?: (prompt: string) => Promise<{ name: string; filePath: string }>;

  list(): McpServerStatus[] {
    return this.configs.map((config) => {
      const enabled = config.enabled !== false;
      if (!enabled) {
        return publicServerStatus({
          id: config.id,
          name: config.name,
          command: config.command,
          args: config.args,
          enabled: false,
          status: "disabled",
          tools: [],
          envKeys: envKeysOf(config.env),
        });
      }
      const running = this.processes.get(config.id);
      return (
        running?.snapshot() ??
        publicServerStatus({
          id: config.id,
          name: config.name,
          command: config.command,
          args: config.args,
          enabled: true,
          status: "error",
          error: "未连接",
          tools: [],
          envKeys: envKeysOf(config.env),
        })
      );
    });
  }

  customTools(): ToolDefinition[] {
    const tools: ToolDefinition[] = [...this.workbenchTools()];
    for (const proc of this.processes.values()) {
      if (proc.status !== "connected") {
        continue;
      }
      for (const tool of proc.tools) {
        const name = toolName(proc.config.id, tool.name);
        const original = tool.name;
        const server = proc;
        tools.push(
          defineTool({
            name,
            label: `${proc.config.name} / ${tool.name}`,
            description: tool.description?.trim() || `MCP 工具 ${tool.name}（${proc.config.name}）`,
            promptSnippet: `MCP ${proc.config.name}: ${tool.name}`,
            parameters: {
              type: "object",
              properties: {},
              additionalProperties: true,
            } as ToolDefinition["parameters"],
            async execute(_toolCallId, params, signal) {
              const args = params && typeof params === "object" ? (params as Record<string, unknown>) : {};
              const text = await server.call(original, args, signal);
              return { content: [{ type: "text", text: clip(text) }], details: { mcp: proc.config.id } };
            },
          }),
        );
      }
    }
    return tools;
  }

  private workbenchTools(): ToolDefinition[] {
    const hub = this;
    return [
      defineTool({
        name: "anvil_add_mcp",
        label: "添加 MCP",
        description:
          "根据用户一句话添加 MCP 外部工具。认识 GitHub、本机文件、记忆、网页，或直接的 npx 启动命令。添加前会请用户确认。",
        promptSnippet: "用户说要接 MCP / 外部工具时调用 anvil_add_mcp。",
        parameters: {
          type: "object",
          properties: {
            text: { type: "string", description: "用户原话，例如 GitHub、本机文件，或 npx -y @modelcontextprotocol/server-github" },
          },
          required: ["text"],
          additionalProperties: false,
        } as ToolDefinition["parameters"],
        async execute(_id, params) {
          const text = String((params as { text?: unknown }).text ?? "").trim();
          if (!hub.onAddMcp) {
            return {
              content: [{ type: "text", text: "当前 Host 不能添加 MCP。" }],
              details: { ok: false, name: "", status: "" },
            };
          }
          const added = await hub.onAddMcp(text);
          return {
            content: [
              {
                type: "text",
                text: `已添加 MCP「${added.name}」，状态 ${added.status}。工具：${added.tools.join("、") || "暂无"}。`,
              },
            ],
            details: { ok: true, name: added.name, status: added.status },
          };
        },
      }),
      defineTool({
        name: "anvil_add_skill",
        label: "添加 Skill",
        description: "根据用户一句话创建 SKILL.md。名称会自动生成。创建前会请用户确认。",
        promptSnippet: "用户说要加一个 Skill / 工作流提示时调用 anvil_add_skill。",
        parameters: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "这个 Skill 做什么，用中文一句话即可" },
          },
          required: ["prompt"],
          additionalProperties: false,
        } as ToolDefinition["parameters"],
        async execute(_id, params) {
          const prompt = String((params as { prompt?: unknown }).prompt ?? "").trim();
          draftSkillFromPrompt(prompt);
          if (!hub.onAddSkill) {
            return {
              content: [{ type: "text", text: "当前 Host 不能创建 Skill。" }],
              details: { ok: false, name: "", filePath: "" },
            };
          }
          const created = await hub.onAddSkill(prompt);
          return {
            content: [
              {
                type: "text",
                text: `已创建 Skill「${created.name}」，文件 ${created.filePath}。对话输入 /skill:${created.name} 即可用。`,
              },
            ],
            details: { ok: true, name: created.name, filePath: created.filePath },
          };
        },
      }),
    ];
  }

  async replace(servers: McpServerConfig[] | undefined): Promise<McpServerStatus[]> {
    this.dispose();
    this.configs = sanitizeServers(servers);
    await Promise.all(
      this.configs
        .filter((item) => item.enabled !== false)
        .map(async (config) => {
          const proc = new McpProcess(config);
          this.processes.set(config.id, proc);
          try {
            await proc.start();
          } catch {
            /* status already recorded on the process */
          }
        }),
    );
    return this.list();
  }

  dispose(): void {
    for (const proc of this.processes.values()) {
      proc.dispose();
    }
    this.processes.clear();
  }
}

export function sanitizeServers(servers: McpServerConfig[] | undefined): McpServerConfig[] {
  if (!Array.isArray(servers)) {
    return [];
  }
  const seen = new Set<string>();
  const next: McpServerConfig[] = [];
  for (const item of servers) {
    const id = item.id?.trim();
    const name = item.name?.trim();
    const command = item.command?.trim();
    if (!id || !name || !command || seen.has(id)) {
      continue;
    }
    seen.add(id);
    next.push({
      id,
      name,
      command,
      args: Array.isArray(item.args) ? item.args.filter((arg) => typeof arg === "string") : [],
      env:
        item.env && typeof item.env === "object"
          ? Object.fromEntries(
              Object.entries(item.env).filter(
                (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string",
              ),
            )
          : undefined,
      enabled: item.enabled !== false,
    });
  }
  return next.slice(0, 12);
}

export function isMcpToolName(name: string): boolean {
  return name.toLowerCase().startsWith("mcp__");
}

export function envKeysOf(env?: Record<string, string>): string[] {
  return env ? Object.keys(env).filter((key) => key.trim() && env[key]?.trim()) : [];
}

export function publicServerStatus(status: McpServerStatus): McpServerStatus {
  const { env: _env, ...rest } = status as McpServerStatus & { env?: Record<string, string> };
  return { ...rest, envKeys: status.envKeys ?? [] };
}

export function mergeEnv(
  current?: Record<string, string>,
  patch?: Record<string, string>,
): Record<string, string> | undefined {
  if (!patch) {
    return current;
  }
  const next = { ...(current ?? {}) };
  for (const [key, value] of Object.entries(patch)) {
    const name = key.trim();
    if (!name) continue;
    if (value === "") {
      delete next[name];
    } else {
      next[name] = value;
    }
  }
  return Object.keys(next).length ? next : undefined;
}

export function stripEnvForProject(servers: McpServerConfig[] | undefined): McpServerConfig[] {
  return (servers ?? []).map(({ env: _env, ...rest }) => rest);
}
