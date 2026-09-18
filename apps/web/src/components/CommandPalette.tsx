import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Terminal,
  FileCode,
  GitBranch,
  CornerDownLeft,
  X,
  Sparkles,
} from "lucide-react";
import { useUiStore } from "../store.ts";
import { client } from "../ws.ts";

type Hit = { path: string; name: string };

const SLASH_COMMANDS = [
  { id: "/compact", hint: "压缩当前会话上下文" },
  { id: "/new", hint: "新建探索分支会话" },
  { id: "/abort", hint: "中止当前正在执行的轮次" },
] as const;

type PaletteRow =
  | { kind: "command"; key: string; command: (typeof SLASH_COMMANDS)[number] }
  | { kind: "session"; key: string; id: string; title: string }
  | { kind: "file"; key: string; path: string };

export function CommandPalette() {
  const open = useUiStore((state) => state.commandOpen);
  const commandMode = useUiStore((state) => state.commandMode);
  const sessions = useUiStore((state) => state.sessions);
  const agentStatus = useUiStore((state) => state.agentStatus);
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setFiles([]);
      setActive(0);
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        useUiStore.getState().setCommandOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 1) {
      setFiles([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void client
        .request("fs.search", { query })
        .then((response) => {
          const payload = response.payload as { hits?: Hit[] };
          setFiles(payload.hits ?? []);
        })
        .catch(() => setFiles([]));
    }, 180);
    return () => window.clearTimeout(handle);
  }, [open, query]);

  const sessionHits = useMemo(() => {
    if (commandMode === "insert" || agentStatus === "running") {
      return [];
    }
    const needle = query.trim().toLowerCase();
    return sessions
      .filter((session) => !needle || session.title.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [sessions, query, commandMode, agentStatus]);

  const commandHits = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (commandMode === "insert") {
      return [];
    }
    const available =
      agentStatus === "running"
        ? SLASH_COMMANDS.filter((item) => item.id === "/abort")
        : SLASH_COMMANDS;
    return available.filter(
      (item) =>
        !needle || item.id.includes(needle) || item.hint.includes(needle),
    );
  }, [query, commandMode, agentStatus]);

  const rows = useMemo<PaletteRow[]>(() => {
    const next: PaletteRow[] = [];
    for (const command of commandHits) {
      next.push({ kind: "command", key: `cmd:${command.id}`, command });
    }
    for (const session of sessionHits) {
      next.push({
        kind: "session",
        key: `sess:${session.id}`,
        id: session.id,
        title: session.title,
      });
    }
    for (const file of files) {
      next.push({ kind: "file", key: `file:${file.path}`, path: file.path });
    }
    return next;
  }, [commandHits, sessionHits, files]);

  useEffect(() => {
    setActive(0);
  }, [query, commandMode, rows.length]);

  const runSlash = async (id: (typeof SLASH_COMMANDS)[number]["id"]) => {
    try {
      if (id === "/compact") {
        await client.request("session.compact", {
          instructions: "保留目标、未完成项和关键结论",
        });
      } else if (id === "/new") {
        await client.request("session.new", { title: "快速新建" });
      } else if (id === "/abort") {
        await client.request("agent.abort", {});
      }
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const selectRow = (row: PaletteRow | undefined) => {
    if (!row) return;
    if (row.kind === "command") {
      void runSlash(row.command.id);
      useUiStore.getState().setCommandOpen(false);
      return;
    }
    if (row.kind === "session") {
      void client
        .request("session.resume", { id: row.id })
        .then(() => {
          useUiStore.getState().setActiveTab("chat");
          useUiStore.getState().setCommandOpen(false);
        })
        .catch((error) => {
          useUiStore.setState({
            lastError: error instanceof Error ? error.message : String(error),
          });
        });
      return;
    }
    if (row.kind === "file") {
      useUiStore.getState().insertPath(row.path);
      useUiStore.getState().setCommandOpen(false);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="命令面板"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 bg-[#1f1e1d]/25 backdrop-blur-[3px]"
      onClick={() => useUiStore.getState().setCommandOpen(false)}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-white border border-[#00000018] shadow-[var(--shadow-float)] overflow-hidden flex flex-col max-h-[70vh] select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 输入框 */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#0000000a] bg-[#faf9f5]/50">
          <Search className="w-4 h-4 text-[#7e7d77] shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((prev) => (prev + 1) % Math.max(1, rows.length));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((prev) => (prev - 1 + rows.length) % Math.max(1, rows.length));
              } else if (e.key === "Enter") {
                e.preventDefault();
                selectRow(rows[active]);
              }
            }}
            placeholder="搜索工程文件、历史会话或执行 /compact 等指令..."
            className="flex-1 bg-transparent text-xs sm:text-[13px] text-[#1f1e1d] outline-none placeholder-[#abaaa2]"
          />
          <kbd className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#edece6] text-[#7e7d77]">
            ESC
          </kbd>
        </div>

        {/* 结果列表 */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 [scrollbar-width:none]">
          {rows.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#abaaa2]">
              未搜索到匹配的文件或指令
            </div>
          ) : (
            rows.map((row, index) => {
              const isSelected = index === active;
              return (
                <button
                  key={row.key}
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => selectRow(row)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-all ${
                    isSelected
                      ? "bg-[#1f1e1d] text-white shadow-[var(--shadow-sm)]"
                      : "text-[#4f4e4a] hover:bg-[#faf9f5]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    {row.kind === "command" ? (
                      <Terminal
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSelected ? "text-white" : "text-[#7e7d77]"
                        }`}
                      />
                    ) : row.kind === "session" ? (
                      <GitBranch
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSelected ? "text-white" : "text-[#7e7d77]"
                        }`}
                      />
                    ) : (
                      <FileCode
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSelected ? "text-white" : "text-[#7e7d77]"
                        }`}
                      />
                    )}

                    <div className="min-w-0 truncate">
                      {row.kind === "command" ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold">{row.command.id}</span>
                          <span
                            className={`text-[11px] truncate ${
                              isSelected ? "text-white/70" : "text-[#7e7d77]"
                            }`}
                          >
                            {row.command.hint}
                          </span>
                        </div>
                      ) : row.kind === "session" ? (
                        <div className="font-medium truncate">{row.title}</div>
                      ) : (
                        <div className="font-mono text-[11px] truncate">{row.path}</div>
                      )}
                    </div>
                  </div>

                  {isSelected ? (
                    <CornerDownLeft className="w-3.5 h-3.5 text-white/70 shrink-0" />
                  ) : null}
                </button>
              );
            })
          )}
        </div>

        {/* 底部键盘说明 */}
        <div className="px-4 py-2 bg-[#faf9f5] border-t border-[#00000008] flex items-center justify-between text-[10.5px] text-[#abaaa2]">
          <span className="flex items-center gap-3">
            <span>↑↓ 导航</span>
            <span>↵ 确认</span>
          </span>
          <span>按 ESC 关闭</span>
        </div>
      </div>
    </div>
  );
}
