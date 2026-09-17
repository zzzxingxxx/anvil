import {
  Sidebar as SidebarIcon,
  FolderGit2,
  Cpu,
  ChevronDown,
  SlidersHorizontal,
  GitBranch,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { useState } from "react";
import { useUiStore } from "../store.ts";
import { client } from "../ws.ts";

export function Header() {
  const {
    connection,
    modelId,
    modelLabel,
    models,
    cwd,
    sessionTitle,
    trust,
    sidebarOpen,
    toggleSidebar,
    inspectorOpen,
    toggleInspector,
    adapter,
  } = useUiStore();
  const [openModels, setOpenModels] = useState(false);

  const handleTrust = async () => {
    try {
      await client.request("workspace.trust", {
        trust: trust === "trusted" ? "untrusted" : "trusted",
      });
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleModel = async (id: string) => {
    setOpenModels(false);
    try {
      await client.request("model.set", { id });
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <header className="h-12 border-b border-[#0000000f] bg-[#faf9f5]/90 backdrop-blur-md px-3.5 flex items-center justify-between select-none shrink-0 z-20">
      <div className="flex items-center gap-2.5">
        <button
          onClick={toggleSidebar}
          title={sidebarOpen ? "隐藏侧边栏" : "显示侧边栏"}
          className={`p-1.5 rounded-lg text-[#7e7d77] hover:text-[#1f1e1d] hover:bg-[#edece6]/70 transition active:scale-95 ${
            !sidebarOpen ? "bg-[#edece6]/70 text-[#1f1e1d]" : ""
          }`}
        >
          <SidebarIcon className="w-4 h-4 stroke-[1.8]" />
        </button>

        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-[#1f1e1d] tracking-tight">
            <span>Anvil</span>
            {adapter === "fake" ? (
              <span className="text-[10px] font-medium text-[#7e7d77] bg-[#edece6] px-1.5 py-0.5 rounded">
                假循环
              </span>
            ) : null}
          </div>

          <span className="text-[#0000001f] font-light">/</span>

          <div className="flex items-center gap-1.5 text-[#4f4e4a] px-1.5 py-0.5 rounded">
            <FolderGit2 className="w-3.5 h-3.5 text-[#7e7d77]" />
            <span className="font-medium truncate max-w-[200px]">
              {cwd ? cwd.split(/[\\/]/).pop() || cwd : "未打开工程"}
            </span>
          </div>

          <span className="text-[#0000001f] font-light">/</span>

          <div className="flex items-center gap-1 text-[#7e7d77] font-mono text-[11px] bg-[#00000008] px-1.5 py-0.5 rounded border border-[#0000000a]">
            <GitBranch className="w-3 h-3 text-[#7e7d77]" />
            <span className="truncate max-w-[130px]">{sessionTitle ?? "main"}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleTrust}
          className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#00000006] border border-[#0000000a] text-[#4f4e4a] text-[11px] hover:bg-[#edece6]"
        >
          {trust === "trusted" ? (
            <>
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>信任模式</span>
            </>
          ) : (
            <>
              <ShieldAlert className="w-3 h-3 text-amber-600" />
              <span>沙箱保护</span>
            </>
          )}
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenModels((open) => !open)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#ffffff] hover:bg-[#fcfbf9] text-[#1f1e1d] text-xs font-mono border border-[#00000014] shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
          >
            <Cpu className="w-3.5 h-3.5 text-[#7e7d77]" />
            <span className="font-medium max-w-[160px] truncate">
              {modelLabel ?? modelId ?? "未配置模型"}
            </span>
            <ChevronDown className="w-3 h-3 text-[#abaaa2]" />
          </button>
          {openModels ? (
            <div className="absolute right-0 mt-1 w-64 max-h-72 overflow-y-auto rounded-xl border border-[#00000014] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.08)] z-30 p-1">
              {models.length === 0 ? (
                <div className="px-3 py-3 text-[11px] text-[#7e7d77] leading-relaxed">
                  没有可用模型。请设置 ANTHROPIC_API_KEY / DEEPSEEK_API_KEY，或在终端运行 pi 登录。
                </div>
              ) : (
                models.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => handleModel(model.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs ${
                      model.id === modelId ? "bg-[#edece6] text-[#1f1e1d]" : "hover:bg-[#f5f4ef] text-[#4f4e4a]"
                    }`}
                  >
                    <div className="font-medium truncate">{model.label}</div>
                    <div className="text-[10px] text-[#abaaa2] font-mono truncate">{model.id}</div>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-[#7e7d77] bg-[#00000005]">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              connection === "open"
                ? "bg-emerald-500 ring-2 ring-emerald-500/20"
                : connection === "connecting"
                  ? "bg-amber-500 animate-pulse"
                  : "bg-stone-300"
            }`}
          />
          <span className="hidden md:inline">
            {connection === "open" ? "就绪" : connection === "connecting" ? "连接中" : "离线"}
          </span>
        </div>

        <button
          onClick={toggleInspector}
          title={inspectorOpen ? "隐藏检查器" : "显示检查器"}
          className={`p-1.5 rounded-lg transition active:scale-95 ${
            inspectorOpen
              ? "bg-[#1f1e1d] text-[#ffffff] shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
              : "text-[#7e7d77] hover:text-[#1f1e1d] hover:bg-[#edece6]/70"
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 stroke-[2]" />
        </button>
      </div>
    </header>
  );
}
