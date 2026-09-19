import { Plus, Trash2, Plug, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { client } from "../ws.ts";
import { useUiStore } from "../store.ts";
import { ConfigPageShell } from "./ConfigPageShell.tsx";

type McpTool = { name: string; description?: string };

type McpServer = {
  id: string;
  name: string;
  command: string;
  args?: string[];
  enabled: boolean;
  status: "connected" | "disabled" | "error" | "connecting";
  error?: string;
  tools: McpTool[];
};

const EXAMPLES: Array<{ id: string; label: string; name: string; command: string; args: string; note: string }> = [
  {
    id: "filesystem",
    label: "本机文件",
    name: "filesystem",
    command: "npx",
    args: "-y @modelcontextprotocol/server-filesystem .",
    note: "把当前目录暴露给 Agent。参数最后一项改成实际路径。",
  },
  {
    id: "github",
    label: "GitHub",
    name: "github",
    command: "npx",
    args: "-y @modelcontextprotocol/server-github",
    note: "需要本机已有 GITHUB_TOKEN 环境变量。",
  },
  {
    id: "memory",
    label: "记忆",
    name: "memory",
    command: "npx",
    args: "-y @modelcontextprotocol/server-memory",
    note: "给 Agent 一个跨轮次的小记忆库。",
  },
];

function parseArgs(value: string): string[] {
  return value
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function McpPage() {
  const cwd = useUiStore((state) => state.cwd);
  const trust = useUiStore((state) => state.trust);
  const busy = useUiStore((state) => state.agentStatus) === "running";
  const [servers, setServers] = useState<McpServer[]>([]);
  const [name, setName] = useState("");
  const [command, setCommand] = useState("npx");
  const [args, setArgs] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const preview = useMemo(() => {
    const parsed = parseArgs(args);
    return [command.trim() || "npx", ...parsed].join(" ");
  }, [command, args]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await client.request("mcp.list", {});
      const payload = response.payload as { servers?: McpServer[] };
      setServers(payload.servers ?? []);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [cwd]);

  const save = async (next: Array<{ id: string; name: string; command: string; args?: string[]; enabled?: boolean }>) => {
    const response = await client.request("mcp.set", { servers: next });
    const payload = response.payload as { servers?: McpServer[] };
    setServers(payload.servers ?? []);
  };

  const snapshot = (list: McpServer[]) =>
    list.map((item) => ({
      id: item.id,
      name: item.name,
      command: item.command,
      args: item.args,
      enabled: item.enabled,
    }));

  const addServer = async () => {
    if (busy || saving || !name.trim() || !command.trim()) return;
    setSaving(true);
    try {
      await save([
        ...snapshot(servers),
        {
          id: `mcp-${Date.now()}`,
          name: name.trim(),
          command: command.trim(),
          args: parseArgs(args),
          enabled: true,
        },
      ]);
      setName("");
      setArgs("");
      setNotice("已添加并尝试连接。状态变「已连接」后，下一轮对话会出现 mcp__ 工具。");
    } catch (caught) {
      useUiStore.setState({
        lastError: caught instanceof Error ? caught.message : String(caught),
      });
    } finally {
      setSaving(false);
    }
  };

  const removeServer = async (id: string) => {
    if (busy) return;
    try {
      await save(snapshot(servers.filter((item) => item.id !== id)));
      setNotice("已移除这台 MCP 服务器。");
    } catch (caught) {
      useUiStore.setState({
        lastError: caught instanceof Error ? caught.message : String(caught),
      });
    }
  };

  const toggleServer = async (id: string, enabled: boolean) => {
    if (busy) return;
    try {
      await save(snapshot(servers).map((item) => (item.id === id ? { ...item, enabled } : item)));
    } catch (caught) {
      useUiStore.setState({
        lastError: caught instanceof Error ? caught.message : String(caught),
      });
    }
  };

  const applyExample = (example: (typeof EXAMPLES)[number]) => {
    setName(example.name);
    setCommand(example.command);
    setArgs(example.args);
    setNotice(`已填入「${example.label}」示例，确认命令后点添加。`);
  };

  const connected = servers.filter((item) => item.status === "connected").length;
  const canAdd = Boolean(name.trim() && command.trim()) && !busy && !saving;

  return (
    <ConfigPageShell
      icon={Plug}
      title="MCP 外部工具"
      detail="在本机用一条启动命令拉起 MCP 服务器。已连接后，Agent 才能看到它的工具。"
      badge={loading ? "加载中" : `${connected} 已连接 / ${servers.length} 台`}
      notice={notice}
      error={error}
    >
      <ol className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
        <li className="rounded-xl border border-[#0000000c] bg-white p-3">
          <div className="font-medium text-[#1f1e1d]">1. 填启动命令</div>
          <p className="text-[#7e7d77] mt-1">显示名随便起；命令和参数就是你在终端里会敲的那一行。</p>
        </li>
        <li className="rounded-xl border border-[#0000000c] bg-white p-3">
          <div className="font-medium text-[#1f1e1d]">2. 等到「已连接」</div>
          <p className="text-[#7e7d77] mt-1">卡片列出工具名，说明进程已经起来。连不上看红字。</p>
        </li>
        <li className="rounded-xl border border-[#0000000c] bg-white p-3">
          <div className="font-medium text-[#1f1e1d]">3. 信任工作区后再用</div>
          <p className="text-[#7e7d77] mt-1">
            {trust === "trusted" ? "当前工作区已信任，下一轮对话可调用。" : "当前未信任，工具会出现但调用会被拦。"}
          </p>
        </li>
      </ol>

      <section className="rounded-2xl border border-[var(--border-card)] bg-white p-5 sm:p-6 shadow-[var(--shadow-card)] space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#1f1e1d]">添加一台服务器</h2>
            <p className="text-[11px] text-[#7e7d77] mt-1">先点示例填表，或自己写命令。保存后 Host 立刻 spawn 这个进程。</p>
          </div>
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => void load()}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-[#5e5c54] hover:bg-[#faf9f5] disabled:opacity-40"
          >
            <RefreshCw className="w-3 h-3" />
            刷新状态
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((example) => (
            <button
              key={example.id}
              type="button"
              onClick={() => applyExample(example)}
              className="px-2.5 py-1 rounded-lg border border-[#00000012] bg-[#faf9f5] text-[11px] text-[#4f4e4a] hover:bg-white"
              title={example.note}
            >
              填入 {example.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3">
          <label className="space-y-1">
            <span className="text-[10.5px] text-[#7e7d77]">
              显示名 <span className="text-rose-500">*</span>
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="给自己看的名字，例如 filesystem"
              className="w-full px-3 py-2 rounded-lg border border-[#00000014] bg-[#faf9f5] text-xs outline-none focus:bg-white"
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1.4fr)] gap-3">
            <label className="space-y-1">
              <span className="text-[10.5px] text-[#7e7d77]">
                启动命令 <span className="text-rose-500">*</span>
              </span>
              <input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="npx"
                className="w-full px-3 py-2 rounded-lg border border-[#00000014] bg-[#faf9f5] text-xs font-mono outline-none focus:bg-white"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10.5px] text-[#7e7d77]">参数（空格分隔）</span>
              <input
                value={args}
                onChange={(e) => setArgs(e.target.value)}
                placeholder="-y @modelcontextprotocol/server-filesystem ."
                className="w-full px-3 py-2 rounded-lg border border-[#00000014] bg-[#faf9f5] text-xs font-mono outline-none focus:bg-white"
              />
            </label>
          </div>
        </div>

        <div className="rounded-xl bg-[#faf9f5] border border-[#0000000c] px-3 py-2 text-[11px]">
          <div className="text-[#7e7d77]">Host 实际会执行</div>
          <code className="block mt-1 font-mono text-[#1f1e1d] break-all">{preview}</code>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-[10.5px] text-[#7e7d77]">
            目前只支持 stdio。密钥走本机环境变量，不要写进参数。调用前仍会弹出审批。
          </p>
          <button
            type="button"
            disabled={!canAdd}
            onClick={() => void addServer()}
            className="px-3 py-2 rounded-lg bg-[#1f1e1d] text-white text-xs font-medium disabled:opacity-40 flex items-center justify-center gap-1 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            {saving ? "正在连接…" : "添加并连接"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border-card)] bg-white p-5 sm:p-6 shadow-[var(--shadow-card)] space-y-3">
        <h2 className="text-sm font-semibold text-[#1f1e1d]">已配置服务器</h2>
        {servers.length === 0 ? (
          <p className="text-[11px] text-[#7e7d77]">还没有服务器。用上面的示例填一张表，点「添加并连接」。</p>
        ) : (
          <div className="space-y-2">
            {servers.map((server) => (
              <div key={server.id} className="rounded-xl border border-[#0000000c] bg-[#faf9f5] p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-[#1f1e1d]">{server.name}</div>
                    <div className="text-[10.5px] font-mono text-[#7e7d77] truncate">
                      {server.command} {(server.args ?? []).join(" ")}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        server.status === "connected"
                          ? "bg-emerald-50 text-emerald-800"
                          : server.status === "disabled"
                            ? "bg-[#edece6] text-[#7e7d77]"
                            : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {server.status === "connected"
                        ? "已连接"
                        : server.status === "disabled"
                          ? "已停用"
                          : server.status === "connecting"
                            ? "连接中"
                            : "出错"}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void toggleServer(server.id, !server.enabled)}
                      className="px-2 py-1 rounded-md text-[10.5px] text-[#5e5c54] hover:bg-white"
                    >
                      {server.enabled ? "停用" : "启用"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void removeServer(server.id)}
                      className="p-1 rounded-md text-[#7e7d77] hover:text-rose-600 hover:bg-rose-50"
                      title="移除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {server.error ? <p className="text-[10.5px] text-rose-700">{server.error}</p> : null}
                {server.tools.length > 0 ? (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {server.tools.map((tool) => (
                      <span
                        key={tool.name}
                        title={tool.description}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white border border-[#0000000c] text-[#4f4e4a]"
                      >
                        {tool.name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </ConfigPageShell>
  );
}
