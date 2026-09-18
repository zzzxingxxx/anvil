import { useEffect, useMemo, useState } from "react";
import { useUiStore } from "../store.ts";
import { client } from "../ws.ts";

type Hit = { path: string; name: string };

const SLASH_COMMANDS = [
  { id: "/compact", hint: "压缩当前会话上下文" },
  { id: "/new", hint: "新建会话" },
  { id: "/abort", hint: "中止当前轮" },
] as const;

export function CommandPalette() {
  const open = useUiStore((state) => state.commandOpen);
  const commandMode = useUiStore((state) => state.commandMode);
  const sessions = useUiStore((state) => state.sessions);
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<Hit[]>([]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setFiles([]);
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
    const needle = query.trim().toLowerCase();
    return sessions
      .filter((session) => !needle || session.title.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [sessions, query]);

  const commandHits = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (commandMode === "insert") {
      return [];
    }
    return SLASH_COMMANDS.filter((item) => !needle || item.id.includes(needle) || item.hint.includes(needle));
  }, [query, commandMode]);

  const runSlash = async (id: (typeof SLASH_COMMANDS)[number]["id"]) => {
    try {
      if (id === "/compact") {
        await client.request("session.compact", { instructions: "保留目标、未完成项和关键结论" });
      } else if (id === "/new") {
        await client.request("session.new", { title: "命令面板新建" });
      } else {
        await client.request("agent.abort", {});
      }
      useUiStore.getState().setCommandOpen(false);
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
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
          placeholder={commandMode === "insert" ? "搜索文件并插入路径…" : "搜索命令、会话或文件…"}
          className="w-full px-4 py-3 text-sm outline-none border-b border-[#0000000c]"
        />
        <div className="max-h-80 overflow-y-auto p-2 text-xs">
          {commandHits.map((command) => (
            <button
              key={command.id}
              type="button"
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#f5f4ef]"
              onClick={() => void runSlash(command.id)}
            >
              <div className="font-mono text-[#1f1e1d]">{command.id}</div>
              <div className="text-[10.5px] text-[#7e7d77]">{command.hint}</div>
            </button>
          ))}
          {sessionHits.map((session) => (
            <button
              key={session.id}
              type="button"
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#f5f4ef]"
              onClick={async () => {
                await client.request("session.resume", { id: session.id });
                useUiStore.getState().setCommandOpen(false);
              }}
            >
              会话 · {session.title}
            </button>
          ))}
          {files.map((file) => (
            <button
              key={file.path}
              type="button"
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#f5f4ef] font-mono"
              onClick={async () => {
                if (commandMode === "insert") {
                  useUiStore.getState().insertPath(file.path);
                  return;
                }
                const response = await client.request("fs.read", { path: file.path });
                const payload = response.payload as { path: string; content: string; truncated?: boolean };
                useUiStore.getState().setPreview(payload);
                useUiStore.getState().setCommandOpen(false);
              }}
            >
              文件 · {file.path}
            </button>
          ))}
          {commandHits.length === 0 && sessionHits.length === 0 && files.length === 0 ? (
            <div className="px-3 py-4 text-[#abaaa2]">
              {commandMode === "insert" ? "选中文件后插入相对路径。" : "输入关键字搜索命令、会话或预览文件。Composer 输入 @ 可插入路径。"}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
