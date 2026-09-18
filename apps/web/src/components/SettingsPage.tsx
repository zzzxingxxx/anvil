import { useEffect, useState } from "react";
import { client } from "../ws.ts";
import { useUiStore } from "../store.ts";

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

  useEffect(() => {
    void client
      .request("settings.get", {})
      .then((response) => {
        const payload = response.payload as { settings?: Settings };
        const next = payload.settings ?? {};
        setSettings(next);
        setAllowlist((next.bashAllowlist ?? ["git status"]).join("\n"));
        setNotice(null);
      })
      .catch((error) => {
        useUiStore.setState({
          lastError: error instanceof Error ? error.message : String(error),
        });
      });
    void client
      .request("model.providers", {})
      .then((response) => {
        const payload = response.payload as { endpoints?: Endpoint[] };
        setEndpoints(payload.endpoints ?? []);
      })
      .catch(() => {
        setEndpoints([]);
      });
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
      setNotice(`已保存 ${payload.provider ?? "自定义接口"}（${payload.imported ?? 0} 个模型）。对话顶栏可切换。`);
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

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4 text-sm">
      <h2 className="text-base font-semibold">设置</h2>
      <p className="text-[12px] text-[#7e7d77]">
        当前工作区是否信任在对话顶栏切换。这里只改模型、bash 白名单。已打开仓库时还会写项目 `.anvil/settings.json`。
      </p>
      <label className="block space-y-1">
        <span className="text-[11px] text-[#7e7d77]">Bash 策略</span>
        <select
          value={settings.bashPolicy ?? "ask"}
          disabled={busy}
          onChange={(event) => setSettings((prev) => ({ ...prev, bashPolicy: event.target.value as Settings["bashPolicy"] }))}
          className="w-full rounded-lg border border-[#00000014] bg-white px-2 py-1.5 disabled:opacity-40"
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
          className="w-full rounded-lg border border-[#00000014] bg-white px-2 py-1.5 font-mono text-[12px] disabled:opacity-40"
        />
      </label>
      <div className="space-y-2 rounded-xl border border-[#00000010] bg-white p-3">
        <div className="text-[11px] text-[#7e7d77]">模型接口</div>
        <p className="text-[11px] text-[#abaaa2] leading-relaxed">
          可添加多套 URL + Key。对话顶栏按接口切换模型。
        </p>
        {endpoints.length > 0 ? (
          <div className="space-y-1">
            {endpoints.map((item) => (
              <div key={item.id} className="flex items-center gap-2 rounded-lg bg-[#faf9f5] px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] text-[#1f1e1d]">{item.id}</div>
                  <div className="truncate text-[10px] text-[#abaaa2] font-mono">{item.baseUrl} · {item.modelCount} 个模型</div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void removeEndpoint(item.id)}
                  className="shrink-0 text-[11px] text-[#7e7d77] hover:text-[#1f1e1d] disabled:opacity-40"
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-[#abaaa2]">还没有自定义接口。</p>
        )}
        <input
          value={importName}
          disabled={busy || importing}
          onChange={(event) => setImportName(event.target.value)}
          placeholder="名称（可选，例如 work / home）"
          className="w-full rounded-lg border border-[#00000014] bg-white px-2 py-1.5 disabled:opacity-40"
        />
        <input
          value={importUrl}
          disabled={busy || importing}
          onChange={(event) => setImportUrl(event.target.value)}
          placeholder="https://example.com/v1"
          className="w-full rounded-lg border border-[#00000014] bg-white px-2 py-1.5 disabled:opacity-40"
        />
        <input
          type="password"
          value={importKey}
          disabled={busy || importing}
          onChange={(event) => setImportKey(event.target.value)}
          placeholder="API Key"
          autoComplete="off"
          className="w-full rounded-lg border border-[#00000014] bg-white px-2 py-1.5 disabled:opacity-40"
        />
        <button
          type="button"
          onClick={() => void importModels()}
          disabled={busy || importing || !importUrl.trim() || !importKey.trim()}
          className="px-3 py-1.5 rounded-lg border border-[#00000014] bg-[#faf9f5] text-xs disabled:opacity-40"
        >
          {importing ? "正在拉取…" : "添加接口"}
        </button>
      </div>
      <label className="block space-y-1">
        <span className="text-[11px] text-[#7e7d77]">当前模型</span>
        {models.length > 0 ? (
          <select
            value={modelId ?? settings.defaultModel ?? ""}
            disabled={busy}
            onChange={(event) => {
              const id = event.target.value;
              setSettings((prev) => ({ ...prev, defaultModel: id || undefined }));
              if (id) {
                void client.request("model.set", { id }).catch((error) => {
                  useUiStore.setState({
                    lastError: error instanceof Error ? error.message : String(error),
                  });
                });
              }
            }}
            className="w-full rounded-lg border border-[#00000014] bg-white px-2 py-1.5 disabled:opacity-40"
          >
            <option value="" disabled>
              选择要使用的模型
            </option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}（{model.id}）
              </option>
            ))}
            {(modelId ?? settings.defaultModel) &&
            !models.some((model) => model.id === (modelId ?? settings.defaultModel)) ? (
              <option value={modelId ?? settings.defaultModel}>{modelId ?? settings.defaultModel}（当前）</option>
            ) : null}
          </select>
        ) : (
          <p className="text-[12px] text-[#7e7d77]">先在上面添加接口，再在这里或对话顶栏选择模型。</p>
        )}
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          title={busy ? "等当前轮结束再改设置" : undefined}
          className="px-3 py-1.5 rounded-lg bg-[#1f1e1d] text-white text-xs disabled:opacity-40"
        >
          保存
        </button>
        {notice ? <span className="text-[11px] text-emerald-800">{notice}</span> : null}
      </div>
      <div className="pt-2 text-[12px] text-[#7e7d77] border-t border-[#00000010]">
        <p>
          费用按天记在本机 `~/.anvil/usage.json`，底栏「复制本周 tokens」只复制脱敏摘要，不上传。
        </p>
        {docker?.available
          ? `已检测到 Docker ${docker.version ?? ""}。整进程进容器仍是可选能力，默认不启用。`
          : docker?.reason ?? "未探测 Docker。没有 Docker 时入口保持隐藏，不阻断启动。"}
      </div>
    </div>
  );
}
