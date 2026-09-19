import { Plus, Trash2, Plug, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
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

export function McpPage() {
  const cwd = useUiStore((state) => state.cwd);
  const busy = useUiStore((state) => state.agentStatus) === "running";
  const [servers, setServers] = useState<McpServer[]>([]);
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    if (busy || !name.trim() || !command.trim()) return;
    const parsedArgs = args
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean);
    try {
      await save([
        ...snapshot(servers),
        {
          id: `mcp-${Date.now()}`,
          name: name.trim(),
          command: command.trim(),
          args: parsedArgs,
          enabled: true,
        },
      ]);
      setName("");
      setCommand("");
      setArgs("");
      setNotice("已保存 MCP 服务器，正在尝试连接。");
    } catch (caught) {
      useUiStore.setState({
        lastError: caught instanceof Error ? caught.message : String(caught),
      });
    }
  };

  const removeServer = async (id: string) => {
    if (busy) return;
    try {
      await save(snapshot(servers.filter((item) => item.id !== id)));
      setNotice("已移除 MCP 服务器。");
    } catch (caught) {
      useUiStore.setState({
        lastError: caught instanceof Error ? caught.message : String(caught),
      });
    }
  };

  const toggleServer = async (id: string, enabled: boolean) => {
    if (busy) return;
    try {
      await save(
        snapshot(servers).map((item) => (item.id === id ? { ...item, enabled } : item)),
      );
    } catch (caught) {
      useUiStore.setState({
        lastError: caught instanceof Error ? caught.message : String(caught),
      });
    }
  };

  const connected = servers.filter((item) => item.status === "connected").length;

  return (
    <ConfigPageShell
      icon={Plug}
      title="MCP 外部工具"
      detail="通过 stdio 启动 MCP 服务器。已信任工作区里会作为自定义工具暴露给 Agent，调用前仍需审批。"
      badge={loading ? "加载中" : `${connected} 已连接 / ${servers.length} 台`}
      notice={notice}
      error={error}
    >
      <section className="rounded-2xl border border-[var(--border-card)] bg-white p-5 sm:p-6 shadow-[var(--shadow-card)] space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#1f1e1d]">添加服务器</h2>
            <p className="text-[11px] text-[#7e7d77] mt-1">填写启动命令后保存。下一轮对话会出现 mcp__ 工具。</p>
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
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_minmax(0,1.2fr)_auto] gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="显示名，如 GitHub"
            className="px-3 py-2 rounded-lg border border-[#00000014] bg-[#faf9f5] text-xs outline-none focus:bg-white"
          />
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="启动命令，如 npx"
            className="px-3 py-2 rounded-lg border border-[#00000014] bg-[#faf9f5] text-xs font-mono outline-none focus:bg-white"
          />
          <input
            value={args}
            onChange={(e) => setArgs(e.target.value)}
            placeholder="参数，空格分隔"
            className="px-3 py-2 rounded-lg border border-[#00000014] bg-[#faf9f5] text-xs font-mono outline-none focus:bg-white"
          />
          <button
            type="button"
            disabled={busy || !name.trim() || !command.trim()}
            onClick={() => void addServer()}
            className="px-3 py-2 rounded-lg bg-[#1f1e1d] text-white text-xs font-medium disabled:opacity-40 flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            添加
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border-card)] bg-white p-5 sm:p-6 shadow-[var(--shadow-card)] space-y-3">
        <h2 className="text-sm font-semibold text-[#1f1e1d]">已配置服务器</h2>
        {servers.length === 0 ? (
          <p className="text-[11px] text-[#7e7d77]">还没有 MCP 服务器。添加后会在下一轮对话里出现 mcp__ 工具。</p>
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
