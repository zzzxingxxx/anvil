import { ChevronDown, KeyRound, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { client } from "../ws.ts";
import { useUiStore } from "../store.ts";
import { groupedModels } from "../lib/models.ts";

type Settings = {
  trustDefault?: "trusted" | "untrusted";
  bashPolicy?: "ask" | "allowlist";
  bashAllowlist?: string[];
  defaultModel?: string;
};

type Endpoint = {
  id: string;
  baseUrl: string;
  modelCount: number;
};

export function SettingsPage() {
  const docker = useUiStore((state) => state.docker);
  const cwd = useUiStore((state) => state.cwd);
  const models = useUiStore((state) => state.models);
  const modelId = useUiStore((state) => state.modelId);
  const busy = useUiStore((state) => state.agentStatus) === "running";
  const [settings, setSettings] = useState<Settings>({ bashPolicy: "ask" });
  const [allowlist, setAllowlist] = useState("git status");
  const [notice, setNotice] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState("");
  const [importKey, setImportKey] = useState("");
  const [importName, setImportName] = useState("");
  const [importing, setImporting] = useState(false);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [bashOpen, setBashOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void client
      .request("settings.get", {})
      .then((response) => {
        if (cancelled) return;
        const payload = response.payload as { settings?: Settings };
        const next = payload.settings ?? {};
        setSettings(next);
        setAllowlist((next.bashAllowlist ?? ["git status"]).join("\n"));
        setNotice(null);
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setLoadError(message);
        useUiStore.setState({ lastError: message });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    void client
      .request("model.providers", {})
      .then((response) => {
        if (cancelled) return;
        const payload = response.payload as { endpoints?: Endpoint[] };
        setEndpoints(payload.endpoints ?? []);
      })
      .catch(() => {
        if (!cancelled) setEndpoints([]);
      });
    return () => {
      cancelled = true;
    };
  }, [cwd]);

  const importModels = async () => {
    if (!importUrl.trim() || !importKey.trim() || busy || importing) {
      return;
    }
    setImporting(true);
    try {
      const response = await client.request("model.import", {
        url: importUrl.trim(),
        apiKey: importKey.trim(),
        provider: importName.trim() || undefined,
      });
      const payload = response.payload as { imported?: number; provider?: string; endpoints?: Endpoint[] };
      setImportKey("");
      setImportName("");
      setEndpoints(payload.endpoints ?? []);
      setNotice(`已保存 ${payload.provider ?? "自定义接口"}（${payload.imported ?? 0} 个模型）。可立刻在下方或顶栏切换。`);
    } catch (error) {
      setNotice(null);
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setImporting(false);
    }
  };

  const removeEndpoint = async (id: string) => {
    try {
      const response = await client.request("model.remove", { provider: id });
      const payload = response.payload as { endpoints?: Endpoint[] };
      setEndpoints(payload.endpoints ?? []);
      setNotice(`已删除 ${id}`);
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const save = async () => {
    try {
      await client.request("settings.set", {
        ...settings,
        bashAllowlist: allowlist
          .split(/\r?\n/)
          .map((item) => item.trim())
          .filter(Boolean),
      });
      setNotice(
        cwd
          ? "已保存到 ~/.anvil/config.json 和项目 .anvil/settings.json"
          : "已保存到 ~/.anvil/config.json",
      );
    } catch (error) {
      setNotice(null);
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const setModelNow = async (id: string) => {
    if (!id) {
      return;
    }
    try {
      await client.request("model.set", { id });
      setSettings((prev) => ({ ...prev, defaultModel: id }));
      setNotice("已切换当前模型，立即生效。");
    } catch (error) {
      setNotice(null);
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-sm text-[#7e7d77]">正在读取设置…</div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-2 text-sm">
        <h2 className="text-base font-semibold">设置无法加载</h2>
        <p className="text-xs text-[#7e7d77]">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-8 space-y-6 text-sm">
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight">设置</h2>
        <p className="text-[12px] text-[#7e7d77] leading-relaxed">
          模型接口和当前模型在这里立刻生效。工作区信任只在顶栏切换（需已打开仓库且空闲）。高级 bash 选项默认收起。
        </p>
      </div>

      <section className="rounded-2xl border border-[#00000010] bg-white p-4 space-y-3 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2">
          <KeyRound className="w-3.5 h-3.5 text-[#7e7d77]" />
          <h3 className="text-xs font-semibold text-[#1f1e1d]">模型接口</h3>
        </div>
        <p className="text-[11px] text-[#abaaa2] leading-relaxed">
          可添加多套 URL + Key。密钥只发给本机 Host，不会出现在日志或页面输出里。添加后立刻可选模型。
        </p>
        {endpoints.length > 0 ? (
          <div className="space-y-1.5">
            {endpoints.map((item) => (
              <div key={item.id} className="flex items-center gap-2 rounded-xl bg-[#faf9f5] px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] text-[#1f1e1d] font-medium">{item.id}</div>
                  <div className="truncate text-[10px] text-[#abaaa2] font-mono">
                    {item.baseUrl} · {item.modelCount} 个模型
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void removeEndpoint(item.id)}
                  className="shrink-0 inline-flex items-center gap-1 text-[11px] text-[#7e7d77] hover:text-rose-800 disabled:opacity-40"
                  aria-label={`删除接口 ${item.id}`}
                >
                  <Trash2 className="w-3 h-3" />
                  删除
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-[#abaaa2] rounded-xl bg-[#faf9f5] px-3 py-2.5">还没有自定义接口。</p>
        )}
        <div className="grid gap-2">
          <input
            value={importName}
            disabled={busy || importing}
            onChange={(event) => setImportName(event.target.value)}
            placeholder="名称（可选，例如 work / home）"
            className="w-full rounded-lg border border-[#00000014] bg-white px-2.5 py-2 disabled:opacity-40 outline-none focus:border-[#00000030]"
          />
          <input
            value={importUrl}
            disabled={busy || importing}
            onChange={(event) => setImportUrl(event.target.value)}
            placeholder="https://example.com/v1"
            className="w-full rounded-lg border border-[#00000014] bg-white px-2.5 py-2 disabled:opacity-40 outline-none focus:border-[#00000030]"
          />
          <input
            type="password"
            value={importKey}
            disabled={busy || importing}
            onChange={(event) => setImportKey(event.target.value)}
            placeholder="API Key"
            autoComplete="off"
            className="w-full rounded-lg border border-[#00000014] bg-white px-2.5 py-2 disabled:opacity-40 outline-none focus:border-[#00000030]"
          />
          <button
            type="button"
            onClick={() => void importModels()}
            disabled={busy || importing || !importUrl.trim() || !importKey.trim()}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#1f1e1d] text-white text-xs disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            {importing ? "正在拉取…" : "添加接口"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[#00000010] bg-white p-4 space-y-3 shadow-[var(--shadow-card)]">
        <h3 className="text-xs font-semibold text-[#1f1e1d]">当前模型</h3>
        {models.length > 0 ? (
          <label className="block space-y-1">
            <span className="text-[11px] text-[#7e7d77]">立刻切换，按接口分组</span>
            <select
              value={modelId ?? ""}
              disabled={busy}
              onChange={(event) => void setModelNow(event.target.value)}
              className="w-full rounded-lg border border-[#00000014] bg-white px-2.5 py-2 disabled:opacity-40 outline-none focus:border-[#00000030]"
            >
              <option value="" disabled>
                选择要使用的模型
              </option>
              {groupedModels(models).map((group) => (
                <optgroup key={group.provider} label={group.provider}>
                  {group.models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label} · {model.id}
                    </option>
                  ))}
                </optgroup>
              ))}
              {modelId && !models.some((model) => model.id === modelId) ? (
                <option value={modelId}>{modelId}（当前）</option>
              ) : null}
            </select>
          </label>
        ) : (
          <p className="text-[12px] text-[#7e7d77] leading-relaxed">先在上面添加接口，再在这里或对话顶栏选择模型。</p>
        )}
      </section>

      <section className="rounded-2xl border border-[#00000010] bg-white shadow-[var(--shadow-card)] overflow-hidden">
        <button
          type="button"
          onClick={() => setBashOpen((value) => !value)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
          aria-expanded={bashOpen}
        >
          <span>
            <span className="block text-xs font-semibold text-[#1f1e1d]">高级 · Bash 策略</span>
            <span className="block text-[11px] text-[#7e7d77] mt-0.5">
              {settings.bashPolicy === "allowlist" ? "白名单，其余询问" : "每次询问"}
            </span>
          </span>
          <ChevronDown className={`w-4 h-4 text-[#abaaa2] transition ${bashOpen ? "rotate-180" : ""}`} />
        </button>
        {bashOpen ? (
          <div className="px-4 pb-4 space-y-3 border-t border-[#00000008] pt-3">
            <label className="block space-y-1">
              <span className="text-[11px] text-[#7e7d77]">Bash 策略</span>
              <select
                value={settings.bashPolicy ?? "ask"}
                disabled={busy}
                onChange={(event) =>
                  setSettings((prev) => ({ ...prev, bashPolicy: event.target.value as Settings["bashPolicy"] }))
                }
                className="w-full rounded-lg border border-[#00000014] bg-white px-2.5 py-2 disabled:opacity-40"
              >
                <option value="ask">每次询问</option>
                <option value="allowlist">白名单，其余询问</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] text-[#7e7d77]">Bash 白名单（每行一条）</span>
              <textarea
                value={allowlist}
                disabled={busy}
                onChange={(event) => setAllowlist(event.target.value)}
                rows={4}
                className="w-full rounded-lg border border-[#00000014] bg-white px-2.5 py-2 font-mono text-[12px] disabled:opacity-40"
              />
            </label>
          </div>
        ) : null}
      </section>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          title={busy ? "等当前轮结束再改设置" : undefined}
          className="px-3.5 py-2 rounded-lg bg-[#1f1e1d] text-white text-xs disabled:opacity-40"
        >
          保存
        </button>
        {notice ? <span className="text-[11px] text-emerald-800">{notice}</span> : null}
      </div>

      <div className="pt-2 text-[12px] text-[#7e7d77] border-t border-[#00000010] leading-relaxed">
        <p>费用按天记在本机 `~/.anvil/usage.json`，底栏「复制本周 tokens」只复制脱敏摘要，不上传。</p>
        <p className="mt-1">
          {docker?.available
            ? `已检测到 Docker ${docker.version ?? ""}。整进程进容器仍是可选能力，默认不启用。`
            : docker?.reason ?? "未探测 Docker。没有 Docker 时入口保持隐藏，不阻断启动。"}
        </p>
      </div>
    </div>
  );
}
