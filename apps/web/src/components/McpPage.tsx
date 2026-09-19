import { Plus, Trash2, Plug, RefreshCw, Sparkles } from "lucide-react";
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

const CHIPS = ["本机文件", "GitHub", "记忆", "网页"];

export function McpPage() {
  const cwd = useUiStore((state) => state.cwd);
  const trust = useUiStore((state) => state.trust);
  const busy = useUiStore((state) => state.agentStatus) === "running";
  const [servers, setServers] = useState<McpServer[]>([]);
  const [text, setText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await client.request("mcp.list", {});
      const payload = response.payload as { servers?: McpServer[] };
      setServers(payload.servers ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [cwd]);

  const addFromText = async (value: string) => {
    const next = value.trim();
    if (!next || busy || saving) return;
    setSaving(true);
    try {
      const response = await client.request("mcp.add", { text: next });
      const payload = response.payload as { added?: McpServer; servers?: McpServer[] };
      setServers(payload.servers ?? []);
      setText("");
      const added = payload.added;
      setNotice(
        added
          ? `已添加「${added.name}」，${added.status === "connected" ? "已连接" : "还没连上"}。${trust === "trusted" ? "下一轮对话可用。" : "先把工作区设为信任。"}`
          : "已保存。",
      );
    } catch (caught) {
      useUiStore.setState({ lastError: caught instanceof Error ? caught.message : String(caught) });
    } finally {
      setSaving(false);
    }
  };

  const askAi = () => {
    const prompt = text.trim()
      ? `帮我添加 MCP：${text.trim()}`
      : "帮我加一个适合当前项目的 MCP 外部工具，需要确认后再添加。";
    useUiStore.setState({ restoredDraft: prompt, activeTab: "chat" });
  };

  const removeServer = async (id: string) => {
    if (busy) return;
    try {
      const response = await client.request("mcp.set", {
        servers: servers
          .filter((item) => item.id !== id)
          .map((item) => ({
            id: item.id,
            name: item.name,
            command: item.command,
            args: item.args,
            enabled: item.enabled,
          })),
      });
      const payload = response.payload as { servers?: McpServer[] };
      setServers(payload.servers ?? []);
      setNotice("已移除。");
    } catch (caught) {
      useUiStore.setState({ lastError: caught instanceof Error ? caught.message : String(caught) });
    }
  };

  const connected = servers.filter((item) => item.status === "connected").length;

  return (
    <ConfigPageShell
      icon={Plug}
      title="MCP 外部工具"
      detail="一句话添加。也可以让对话里的 Agent 帮你加，加之前会弹出确认。"
      badge={loading ? "加载中" : `${connected}/${servers.length} 已连接`}
      notice={notice}
      error={error}
    >
      <section className="rounded-2xl border border-[var(--border-card)] bg-white p-5 sm:p-6 shadow-[var(--shadow-card)] space-y-3">
        <h2 className="text-sm font-semibold text-[#1f1e1d]">添加</h2>
        <div className="flex flex-wrap gap-1.5">
          {CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={busy || saving}
              onClick={() => void addFromText(chip)}
              className="px-2.5 py-1 rounded-lg border border-[#00000012] bg-[#faf9f5] text-[11px] text-[#4f4e4a] hover:bg-white disabled:opacity-40"
            >
              {chip}
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void addFromText(text);
              }
            }}
            placeholder="GitHub，或直接贴 npx 命令"
            className="flex-1 px-3 py-2 rounded-lg border border-[#00000014] bg-[#faf9f5] text-xs outline-none focus:bg-white"
          />
          <button
            type="button"
            disabled={busy || saving || !text.trim()}
            onClick={() => void addFromText(text)}
            className="px-3 py-2 rounded-lg bg-[#1f1e1d] text-white text-xs font-medium disabled:opacity-40 flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            {saving ? "正在添加…" : "添加"}
          </button>
          <button
            type="button"
            onClick={askAi}
            className="px-3 py-2 rounded-lg border border-[#00000014] text-xs text-[#4f4e4a] hover:bg-[#faf9f5] flex items-center justify-center gap-1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            让 AI 添加
          </button>
        </div>
        <p className="text-[10.5px] text-[#7e7d77]">
          {trust === "trusted" ? "工作区已信任，连上后下一轮就能用。" : "未信任时可以添加，但 Agent 不能真正调用。"}
        </p>
      </section>

      <section className="rounded-2xl border border-[var(--border-card)] bg-white p-5 sm:p-6 shadow-[var(--shadow-card)] space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#1f1e1d]">已添加</h2>
          <button
            type="button"
            disabled={loading}
            onClick={() => void load()}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-[#5e5c54] hover:bg-[#faf9f5] disabled:opacity-40"
          >
            <RefreshCw className="w-3 h-3" />
            刷新
          </button>
        </div>
        {servers.length === 0 ? (
          <p className="text-[11px] text-[#7e7d77]">还没有。点上面的 GitHub / 本机文件，或让 AI 帮你加。</p>
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
                      {server.status === "connected" ? "已连接" : server.status === "disabled" ? "已停用" : "出错"}
                    </span>
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
                  <div className="flex flex-wrap gap-1">
                    {server.tools.map((tool) => (
                      <span key={tool.name} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white border border-[#0000000c] text-[#4f4e4a]">
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
