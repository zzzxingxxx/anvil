import { useEffect, useState } from "react";
import { client } from "../ws.ts";
import { useUiStore } from "../store.ts";

type Settings = {
  trustDefault?: "trusted" | "untrusted";
  bashPolicy?: "ask" | "allowlist";
  bashAllowlist?: string[];
  defaultModel?: string;
};

export function SettingsPage() {
  const docker = useUiStore((state) => state.docker);
  const [settings, setSettings] = useState<Settings>({ bashPolicy: "ask" });
  const [allowlist, setAllowlist] = useState("git status");

  useEffect(() => {
    void client
      .request("settings.get", {})
      .then((response) => {
        const payload = response.payload as { settings?: Settings };
        const next = payload.settings ?? {};
        setSettings(next);
        setAllowlist((next.bashAllowlist ?? ["git status"]).join("\n"));
      })
      .catch((error) => {
        useUiStore.setState({
          lastError: error instanceof Error ? error.message : String(error),
        });
      });
  }, []);

  const save = async () => {
    try {
      await client.request("settings.set", {
        ...settings,
        bashAllowlist: allowlist
          .split(/\r?\n/)
          .map((item) => item.trim())
          .filter(Boolean),
      });
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4 text-sm">
      <h2 className="text-base font-semibold">设置</h2>
      <p className="text-[12px] text-[#7e7d77]">
        全局写到 `~/.anvil/config.json`。已打开工作区时还会写项目 `.anvil/settings.json`（覆盖本仓库策略）。浏览器不能直接读盘。白名单之外的 bash 仍会弹审批。
      </p>
      <label className="block space-y-1">
        <span className="text-[11px] text-[#7e7d77]">Bash 策略</span>
        <select
          value={settings.bashPolicy ?? "ask"}
          onChange={(event) => setSettings((prev) => ({ ...prev, bashPolicy: event.target.value as Settings["bashPolicy"] }))}
          className="w-full rounded-lg border border-[#00000014] bg-white px-2 py-1.5"
        >
          <option value="ask">每次询问</option>
          <option value="allowlist">白名单，其余询问</option>
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-[11px] text-[#7e7d77]">Bash 白名单（每行一条）</span>
        <textarea
          value={allowlist}
          onChange={(event) => setAllowlist(event.target.value)}
          rows={4}
          className="w-full rounded-lg border border-[#00000014] bg-white px-2 py-1.5 font-mono text-[12px]"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-[11px] text-[#7e7d77]">默认模型 id（provider/model）</span>
        <input
          value={settings.defaultModel ?? ""}
          onChange={(event) => setSettings((prev) => ({ ...prev, defaultModel: event.target.value }))}
          className="w-full rounded-lg border border-[#00000014] bg-white px-2 py-1.5"
        />
      </label>
      <button type="button" onClick={save} className="px-3 py-1.5 rounded-lg bg-[#1f1e1d] text-white text-xs">
        保存
      </button>
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
