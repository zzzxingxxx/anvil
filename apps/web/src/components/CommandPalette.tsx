import { useEffect, useMemo, useState } from "react";
import { useUiStore } from "../store.ts";
import { client } from "../ws.ts";

type Hit = { path: string; name: string };

export function CommandPalette() {
  const open = useUiStore((state) => state.commandOpen);
  const sessions = useUiStore((state) => state.sessions);
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<Hit[]>([]);

  useEffect(() => {
    if (!open) {
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

  const sessionHits = useMemo(
    () =>
      sessions.filter((session) => session.title.toLowerCase().includes(query.toLowerCase())).slice(0, 8),
    [sessions, query],
  );

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
          placeholder="搜索会话或文件…"
          className="w-full px-4 py-3 text-sm outline-none border-b border-[#0000000c]"
        />
        <div className="max-h-80 overflow-y-auto p-2 text-xs">
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
              onClick={() => {
                useUiStore.getState().insertPath(file.path);
              }}
            >
              文件 · {file.path}
            </button>
          ))}
          {sessionHits.length === 0 && files.length === 0 ? (
            <div className="px-3 py-4 text-[#abaaa2]">输入关键字搜索。也可用 @文件名 在输入框插入路径。</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
