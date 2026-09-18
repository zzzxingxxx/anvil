import { useEffect, useMemo, useState } from "react";
import { useUiStore } from "../store.ts";
import { client } from "../ws.ts";

type Hit = { path: string; name: string };

const SLASH_COMMANDS = [
  { id: "/compact", hint: "压缩当前会话上下文" },
  { id: "/new", hint: "新建会话" },
  { id: "/abort", hint: "中止当前轮" },
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
    const available = agentStatus === "running" ? SLASH_COMMANDS.filter((item) => item.id === "/abort") : SLASH_COMMANDS;
    return available.filter((item) => !needle || item.id.includes(needle) || item.hint.includes(needle));
  }, [query, commandMode, agentStatus]);

  const rows = useMemo<PaletteRow[]>(() => {
    const next: PaletteRow[] = [];
    for (const command of commandHits) {
      next.push({ kind: "command", key: `cmd:${command.id}`, command });
    }
    for (const session of sessionHits) {
      next.push({ kind: "session", key: `sess:${session.id}`, id: session.id, title: session.title });
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
        await client.request("session.compact", { instructions: "保留目标、未完成项和关键结论" });
      } else if (id === "/new") {
        await client.request("session.new", { title: "命令面板新建" });
      } else {
        const response = await client.request("agent.abort", {});
        const restored = (response.payload as { restoredDraft?: string }).restoredDraft;
        useUiStore.getState().consumeRestoredDraft();
        if (restored) {
          useUiStore.setState({ restoredDraft: restored });
        }
      }
      useUiStore.getState().setCommandOpen(false);
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const activate = async (row: PaletteRow) => {
    if (row.kind === "command") {
      await runSlash(row.command.id);
      return;
    }
    if (row.kind === "session") {
      try {
        await client.request("session.resume", { id: row.id });
        useUiStore.getState().setCommandOpen(false);
      } catch (error) {
        useUiStore.setState({
          lastError: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }
    try {
      if (commandMode === "insert") {
        useUiStore.getState().insertPath(row.path);
        return;
      }
      const response = await client.request("fs.read", { path: row.path });
      const payload = response.payload as { path: string; content: string; truncated?: boolean };
      useUiStore.getState().setPreview(payload);
      useUiStore.getState().setCommandOpen(false);
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((value) => (rows.length === 0 ? 0 : Math.min(value + 1, rows.length - 1)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((value) => Math.max(0, value - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const row = rows[active];
      if (row) {
        void activate(row);
      }
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/20 flex items-start justify-center pt-24" onClick={() => useUiStore.getState().setCommandOpen(false)}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white border border-[#00000014] shadow-[0_16px_40px_rgba(0,0,0,0.12)] overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder={commandMode === "insert" ? "搜索文件并插入路径…" : "搜索命令、会话或文件…"}
          className="w-full px-4 py-3 text-sm outline-none border-b border-[#0000000c]"
        />
        <div className="max-h-80 overflow-y-auto p-2 text-xs">
          {rows.map((row, index) => (
            <button
              key={row.key}
              type="button"
              className={`w-full text-left px-3 py-2 rounded-lg ${index === active ? "bg-[#f5f4ef]" : "hover:bg-[#f5f4ef]"}`}
              onMouseEnter={() => setActive(index)}
              onClick={() => void activate(row)}
            >
              {row.kind === "command" ? (
                <>
                  <div className="font-mono text-[#1f1e1d]">{row.command.id}</div>
                  <div className="text-[10.5px] text-[#7e7d77]">{row.command.hint}</div>
                </>
              ) : row.kind === "session" ? (
                <>会话 · {row.title}</>
              ) : (
                <span className="font-mono">文件 · {row.path}</span>
              )}
            </button>
          ))}
          {rows.length === 0 ? (
            <div className="px-3 py-6 text-center text-[#abaaa2] leading-relaxed">
              {commandMode === "insert"
                ? "输入文件名，选中后插入相对路径。"
                : query.trim()
                  ? "没有匹配的命令、会话或文件。"
                  : "输入关键字搜索命令、会话或预览文件。对话输入 @ 可插入路径。"}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
