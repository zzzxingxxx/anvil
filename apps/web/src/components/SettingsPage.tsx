import {
  ChevronDown,
  Plus,
  Trash2,
  Cpu,
  Terminal,
  Server,
  CheckCircle2,
  AlertCircle,
  Bot,
} from "lucide-react";
import { useEffect, useState } from "react";
import { client } from "../ws.ts";
import { useUiStore } from "../store.ts";
import { groupedModels } from "../lib/models.ts";

type PersonaId = "architect" | "implementer" | "reviewer";

type Settings = {
  trustDefault?: "trusted" | "untrusted";
  bashPolicy?: "ask" | "allowlist";
  bashAllowlist?: string[];
  defaultModel?: string;
  personaModels?: Partial<Record<PersonaId, string>>;
};

const PERSONA_OPTIONS: Array<{ id: PersonaId; label: string; detail: string }> = [
  { id: "architect", label: "架构师", detail: "只读梳理模块、给出方案" },
  { id: "implementer", label: "实现者", detail: "改文件、跑命令、落地实现" },
  { id: "reviewer", label: "审查者", detail: "检查改动与潜在问题" },
];

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
      const payload = response.payload as {
        imported?: number;
        provider?: string;
        endpoints?: Endpoint[];
      };
      setImportKey("");
      setImportName("");
      setEndpoints(payload.endpoints ?? []);
      setNotice(
        `已保存 ${payload.provider ?? "自定义接口"}（${payload.imported ?? 0} 个模型）。可立刻在下方或顶栏切换。`,
      );
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
    if (busy) return;
    try {
      const response = await client.request("model.remove", { id });
      const payload = response.payload as {
        endpoints?: Endpoint[];
        removed?: number;
      };
      setEndpoints(payload.endpoints ?? []);
      setNotice(`已移除接口并移除了 ${payload.removed ?? 0} 个关联模型。`);
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const setModelNow = async (selectedId: string) => {
    if (busy) return;
    try {
      await client.request("model.set", { id: selectedId });
      setSettings((prev) => ({ ...prev, defaultModel: selectedId }));
      setNotice("已切换模型并保存为默认。");
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const setPersonaModel = async (persona: PersonaId, selectedId: string) => {
    if (busy) return;
    const personaModels = {
      ...(settings.personaModels ?? {}),
      [persona]: selectedId || undefined,
    };
    try {
      await client.request("settings.set", { personaModels });
      setSettings((prev) => ({ ...prev, personaModels }));
      setNotice(
        selectedId
          ? `已为${PERSONA_OPTIONS.find((item) => item.id === persona)?.label ?? persona}指定模型。`
          : `已让${PERSONA_OPTIONS.find((item) => item.id === persona)?.label ?? persona}跟随主会话模型。`,
      );
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const saveBashSettings = async () => {
    if (busy) return;
    try {
      const lines = allowlist
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      await client.request("settings.set", {
        settings: {
          bashPolicy: settings.bashPolicy,
          bashAllowlist: lines,
        },
      });
      setNotice("终端安全策略已保存。");
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const grouped = groupedModels(models);

  return (
    <div className="flex-1 min-h-0 h-full w-full overflow-y-auto overscroll-contain bg-[var(--bg-app)] [scrollbar-gutter:stable]">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8 space-y-8 select-text">
        {/* 页面标题 */}
        <div className="border-b border-[#0000000a] pb-4">
          <h1 className="text-xl font-bold text-[#1f1e1d] tracking-tight">工作台设置</h1>
          <p className="text-xs text-[#7e7d77] mt-1">
            管理 AI 模型接口、多端 URL+Key、系统终端执行策略及运行环境。
          </p>
        </div>

        {/* 提示通知条 */}
        {notice ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
        ) : null}

        {loadError ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>加载设置失败：{loadError}</span>
          </div>
        ) : null}

        {/* 卡片 1: 模型与接口管理 */}
        <section className="rounded-2xl border border-[var(--border-card)] bg-white p-5 sm:p-6 shadow-[var(--shadow-card)] space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#faf9f5] border border-[#0000000a] flex items-center justify-center text-[#1f1e1d]">
                <Cpu className="w-4 h-4 text-[#5e5c54]" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#1f1e1d]">模型与接口管理</h2>
                <p className="text-[11px] text-[#7e7d77]">
                  支持接入任何兼容 OpenAI 标准的 Base URL 与 API Key，支持多接口切换。
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-[#edece6] text-[#4f4e4a]">
              {models.length} 个可用模型
            </span>
          </div>

          {/* 当前生效模型快速选择 */}
          <div className="p-3.5 rounded-xl bg-[#faf9f5] border border-[#0000000c] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[#1f1e1d]">当前使用 / 默认模型</span>
              <span className="text-[11px] text-[#7e7d77] font-mono">
                {modelId ?? "未选择"}
              </span>
            </div>
            <select
              value={modelId ?? settings.defaultModel ?? ""}
              onChange={(e) => void setModelNow(e.target.value)}
              disabled={busy || loading || models.length === 0}
              className="w-full px-3 py-2 rounded-lg border border-[#00000014] bg-white text-xs text-[#1f1e1d] outline-none focus:border-[#00000030]"
            >
              {models.length === 0 ? (
                <option value="">暂无可用模型，请先在下方添加接口</option>
              ) : null}
              {grouped.map(({ provider, models: list }) => (
                <optgroup key={provider} label={provider}>
                  {list.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label || m.id}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="space-y-3 pt-1">
            <div>
              <div className="text-xs font-semibold text-[#1f1e1d] flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-[#7e7d77]" />
                <span>子智能体模型</span>
              </div>
              <p className="text-[11px] text-[#7e7d77] mt-1">
                分别为架构师、实现者、审查者指定模型。留空则跟随上方主会话模型。派发 @agent 时立即生效。
              </p>
            </div>
            <div className="grid gap-2.5">
              {PERSONA_OPTIONS.map((persona) => (
                <div
                  key={persona.id}
                  className="grid grid-cols-1 sm:grid-cols-[7.5rem_minmax(0,1fr)] gap-2 items-center p-3 rounded-xl bg-[#faf9f5] border border-[#0000000c]"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-[#1f1e1d]">{persona.label}</div>
                    <div className="text-[10.5px] text-[#7e7d77]">{persona.detail}</div>
                  </div>
                  <select
                    value={settings.personaModels?.[persona.id] ?? ""}
                    onChange={(e) => void setPersonaModel(persona.id, e.target.value)}
                    disabled={busy || loading}
                    className="w-full px-3 py-2 rounded-lg border border-[#00000014] bg-white text-xs text-[#1f1e1d] outline-none focus:border-[#00000030]"
                  >
                    <option value="">跟随主会话模型</option>
                    {grouped.map(({ provider, models: list }) => (
                      <optgroup key={`${persona.id}-${provider}`} label={provider}>
                        {list.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label || m.id}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* 添加新接口卡片 */}
          <div className="space-y-3 pt-2">
            <div className="text-xs font-semibold text-[#1f1e1d] flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-[#7e7d77]" />
              <span>添加新模型服务接口</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[10.5px] text-[#7e7d77]">
                  接口地址 (Base URL) <span className="text-rose-500">*</span>
                </label>
                <input
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full px-3 py-2 rounded-lg border border-[#00000012] bg-[#faf9f5] text-xs outline-none focus:bg-white focus:border-[#00000030] font-mono text-[11px]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10.5px] text-[#7e7d77]">
                  接口密钥 (API Key) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  value={importKey}
                  onChange={(e) => setImportKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 rounded-lg border border-[#00000012] bg-[#faf9f5] text-xs outline-none focus:bg-white focus:border-[#00000030] font-mono text-[11px]"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 items-end pt-1">
              <div className="space-y-1 flex-1 w-full">
                <label className="text-[10.5px] text-[#7e7d77]">
                  自定义分组标签 (可选)
                </label>
                <input
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  placeholder="如：DeepSeek / 硅基流动 / 内部网关"
                  className="w-full px-3 py-2 rounded-lg border border-[#00000012] bg-[#faf9f5] text-xs outline-none focus:bg-white focus:border-[#00000030]"
                />
              </div>

              <button
                type="button"
                disabled={!importUrl.trim() || !importKey.trim() || busy || importing}
                onClick={importModels}
                className="w-full sm:w-auto px-4 py-2 rounded-lg bg-[#1f1e1d] hover:bg-[#343230] text-white text-xs font-medium transition-all shadow-[var(--shadow-sm)] active:scale-[0.98] disabled:opacity-40 shrink-0"
              >
                {importing ? "正在拉取模型…" : "获取并保存接口"}
              </button>
            </div>
          </div>

          {/* 已配置接口列表 */}
          <div className="space-y-2 pt-2 border-t border-[#00000008]">
            <div className="text-xs font-medium text-[#1f1e1d]">已配置的服务端点</div>
            {endpoints.length === 0 ? (
              <div className="p-3 text-center text-xs text-[#abaaa2] rounded-xl border border-dashed border-[#0000000f]">
                暂无自定义端点，请在上方添加 OpenAI 兼容格式接口。
              </div>
            ) : (
              <div className="grid gap-2">
                {endpoints.map((ep) => (
                  <div
                    key={ep.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#faf9f5] border border-[#0000000a] text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-medium text-[#1f1e1d] truncate">
                        {ep.id}
                      </div>
                      <div className="text-[10.5px] text-[#7e7d77] font-mono truncate">
                        {ep.baseUrl}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[10px] text-[#7e7d77] font-mono bg-white px-2 py-0.5 rounded border border-[#00000008]">
                        {ep.modelCount} 模型
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void removeEndpoint(ep.id)}
                        className="p-1.5 rounded-md text-[#7e7d77] hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-40"
                        title="移除该接口"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 卡片 2: 终端与执行策略 */}
        <section className="rounded-2xl border border-[var(--border-card)] bg-white p-5 sm:p-6 shadow-[var(--shadow-card)] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#faf9f5] border border-[#0000000a] flex items-center justify-center text-[#1f1e1d]">
                <Terminal className="w-4 h-4 text-[#5e5c54]" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#1f1e1d]">终端执行安全策略</h2>
                <p className="text-[11px] text-[#7e7d77]">
                  控制 Agent 在执行 Bash 命令行时的审批策略与允许指令清单。
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setBashOpen((v) => !v)}
              className="text-xs text-[#7e7d77] hover:text-[#1f1e1d] flex items-center gap-1 font-medium"
            >
              <span>{bashOpen ? "收起" : "展开配置"}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${bashOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          {bashOpen ? (
            <div className="space-y-4 pt-2 border-t border-[#00000008]">
              <div className="space-y-2">
                <label className="text-xs font-medium text-[#1f1e1d]">执行策略模式</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 text-xs text-[#4f4e4a] cursor-pointer">
                    <input
                      type="radio"
                      name="bashPolicy"
                      checked={settings.bashPolicy === "ask"}
                      onChange={() =>
                        setSettings((prev) => ({ ...prev, bashPolicy: "ask" }))
                      }
                      className="accent-[#1f1e1d]"
                    />
                    <span>每次调用均弹窗审批 (推荐)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-[#4f4e4a] cursor-pointer">
                    <input
                      type="radio"
                      name="bashPolicy"
                      checked={settings.bashPolicy === "allowlist"}
                      onChange={() =>
                        setSettings((prev) => ({ ...prev, bashPolicy: "allowlist" }))
                      }
                      className="accent-[#1f1e1d]"
                    />
                    <span>白名单免审批自动放行</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#1f1e1d]">
                  白名单命令前缀 (每行一条)
                </label>
                <textarea
                  rows={4}
                  value={allowlist}
                  onChange={(e) => setAllowlist(e.target.value)}
                  placeholder="git status&#10;git diff&#10;pnpm test"
                  className="w-full px-3 py-2 rounded-lg border border-[#00000012] bg-[#faf9f5] text-xs font-mono outline-none focus:bg-white focus:border-[#00000030]"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={busy}
                  onClick={saveBashSettings}
                  className="px-4 py-2 rounded-lg bg-[#1f1e1d] hover:bg-[#343230] text-white text-xs font-medium shadow-[var(--shadow-sm)] transition-all active:scale-[0.98] disabled:opacity-40"
                >
                  保存安全策略
                </button>
              </div>
            </div>
          ) : null}
        </section>

        {/* 卡片 3: 系统与运行环境 */}
        <section className="rounded-2xl border border-[var(--border-card)] bg-white p-5 sm:p-6 shadow-[var(--shadow-card)] space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#faf9f5] border border-[#0000000a] flex items-center justify-center text-[#1f1e1d]">
              <Server className="w-4 h-4 text-[#5e5c54]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#1f1e1d]">微内核宿主与运行环境</h2>
              <p className="text-[11px] text-[#7e7d77]">
                底层引擎与本机服务状态。
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-[#faf9f5] border border-[#00000008] space-y-1">
              <div className="text-[11px] text-[#7e7d77]">AI 引擎核心</div>
              <div className="font-semibold text-[#1f1e1d]">
                @earendil-works/pi-coding-agent @0.85.1
              </div>
              <div className="text-[10.5px] text-[#abaaa2]">官方标准微内核 · 无私有格式</div>
            </div>

            <div className="p-3 rounded-xl bg-[#faf9f5] border border-[#00000008] space-y-1">
              <div className="text-[11px] text-[#7e7d77]">Docker 容器沙箱</div>
              <div className="font-semibold text-[#1f1e1d]">
                {docker?.available ? "已就绪" : "未运行"}
              </div>
              <div className="text-[10.5px] text-[#abaaa2] truncate">
                {docker?.reason ?? "本机已支持容器环境"}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
