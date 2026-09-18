import { Check, ChevronDown, Cpu, Settings2 } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { findModel, groupedModels } from "../lib/models.ts";
import { cn } from "../lib/utils.ts";
import { useUiStore } from "../store.ts";
import { client } from "../ws.ts";

export function ModelSelector({ compact = false }: { compact?: boolean }) {
  const models = useUiStore((state) => state.models);
  const modelId = useUiStore((state) => state.modelId);
  const modelLabel = useUiStore((state) => state.modelLabel);
  const busy = useUiStore((state) => state.agentStatus) === "running";
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0);
  const buttonId = useId();
  const listId = useId();
  const groups = useMemo(() => groupedModels(models), [models]);
  const selected = findModel(models, modelId);
  const confirmed = Boolean(modelId || modelLabel);
  const provider = selected?.provider ?? (confirmed ? "已选" : "模型");
  const label = selected?.label ?? modelLabel ?? modelId ?? "选择模型";
  const flat = useMemo(() => groups.flatMap((group) => group.models), [groups]);

  activeRef.current = active;

  const handleModel = useCallback(async (id: string) => {
    setOpen(false);
    if (id === modelId) {
      return;
    }
    try {
      await client.request("model.set", { id });
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  }, [modelId]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const selectedIndex = flat.findIndex((model) => model.id === modelId);
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (flat.length === 0) {
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((value) => (value + 1) % flat.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((value) => (value - 1 + flat.length) % flat.length);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const chosen = flat[activeRef.current];
        if (chosen) {
          void handleModel(chosen.id);
        }
      }
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, flat, modelId, handleModel]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const node = listRef.current?.querySelector<HTMLElement>(`[data-model-index="${active}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        id={buttonId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={busy}
        aria-label={busy ? "等当前轮结束再切换模型" : `当前模型 ${provider} ${label}`}
        title={busy ? "等当前轮结束再切换模型" : `${provider} · ${label}`}
        onClick={() => {
          if (busy) {
            return;
          }
          setOpen((value) => !value);
        }}
        className={cn(
          "flex items-center gap-1.5 min-w-0 rounded-lg bg-white hover:bg-[#fcfbf9] text-[#1f1e1d] border border-[#00000014] shadow-[var(--shadow-sm)] disabled:opacity-40",
          compact ? "h-7 px-1.5 sm:px-2" : "px-2.5 py-1.5",
        )}
      >
        <Cpu className="w-3.5 h-3.5 text-[#7e7d77] shrink-0" />
        <span className="min-w-0 flex-1 text-left leading-tight">
          {compact ? (
            <span className="flex items-baseline gap-1 min-w-0">
              <span className="hidden md:inline text-[10px] uppercase tracking-wider text-[#7e7d77] truncate max-w-[5rem]">
                {provider}
              </span>
              <span className="text-[11px] font-medium truncate max-w-[6.5rem] sm:max-w-[10rem]">{label}</span>
            </span>
          ) : (
            <>
              <span className="block text-[10px] uppercase tracking-wider text-[#7e7d77] truncate">{provider}</span>
              <span className="block text-xs font-medium truncate max-w-[16rem]">{label}</span>
            </>
          )}
        </span>
        <ChevronDown className={cn("w-3 h-3 text-[#abaaa2] shrink-0 transition", open && "rotate-180")} />
      </button>
      {open ? (
        <div
          id={listId}
          ref={listRef}
          role="listbox"
          aria-labelledby={buttonId}
          className="z-40 max-h-80 overflow-y-auto rounded-xl border border-[#00000014] bg-white shadow-[var(--shadow-float)] p-1 max-sm:fixed max-sm:left-4 max-sm:right-4 max-sm:top-12 max-sm:w-auto sm:absolute sm:right-0 sm:mt-1 sm:w-[min(22rem,calc(100vw-2rem))]"
        >
          {models.length === 0 ? (
            <div className="px-3 py-3 space-y-2">
              <p className="text-[11px] text-[#7e7d77] leading-relaxed">
                没有可用模型。到设置页添加接口，或在终端运行 pi 登录。
              </p>
              <button
                type="button"
                className="flex items-center gap-1.5 text-[11px] text-[#1f1e1d] hover:underline"
                onClick={() => {
                  setOpen(false);
                  useUiStore.getState().setActiveTab("settings");
                }}
              >
                <Settings2 className="w-3 h-3" />
                打开设置
              </button>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.provider} className="pb-1">
                <div className="px-2.5 pt-1.5 pb-0.5 text-[10px] uppercase tracking-wider text-[#abaaa2]">
                  {group.provider}
                </div>
                {group.models.map((model) => {
                  const index = flat.findIndex((item) => item.id === model.id);
                  const isSelected = model.id === modelId;
                  const isActive = index === active;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      data-model-index={index}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => void handleModel(model.id)}
                      className={cn(
                        "w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-start gap-2",
                        isSelected
                          ? "bg-[#edece6] text-[#1f1e1d]"
                          : isActive
                            ? "bg-[#f5f4ef] text-[#4f4e4a]"
                            : "text-[#4f4e4a] hover:bg-[#f5f4ef]",
                      )}
                    >
                      <Check className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                      <span className="min-w-0">
                        <span className="block font-medium truncate">{model.label}</span>
                        <span className="block text-[10px] text-[#abaaa2] font-mono truncate">{model.id}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
