import { ArrowUp, Square, Sparkles, CornerDownRight, ListPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useUiStore } from "../store.ts";
import { client } from "../ws.ts";

interface ComposerProps {
  onSend: (text: string) => Promise<void>;
  sending: boolean;
}

const PERSONA_ALIASES: Record<string, "architect" | "implementer" | "reviewer"> = {
  architect: "architect",
  implementer: "implementer",
  reviewer: "reviewer",
  架构师: "architect",
  实现者: "implementer",
  审查者: "reviewer",
};

function parseAgentMention(text: string): { persona: "architect" | "implementer" | "reviewer"; goal: string } | null {
  const match = text.match(/^@agent:(\S+)\s+(.+)$/s);
  if (!match) {
    return null;
  }
  const persona = PERSONA_ALIASES[match[1] ?? ""];
  const goal = match[2]?.trim();
  if (!persona || !goal) {
    return null;
  }
  return { persona, goal };
}

export function Composer({ onSend, sending }: ComposerProps) {
  const [draft, setDraft] = useState("");
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { agentStatus, connection, cwd, pendingInsert, restoredDraft } = useUiStore();
  const isRunning = agentStatus === "running";
  const slashCommands = [
    { id: "/compact", hint: "压缩当前会话上下文" },
    { id: "/new", hint: "新建会话" },
    { id: "/abort", hint: "中止当前轮" },
  ];
  const visibleSlash = slashCommands.filter((item) => item.id.startsWith(draft.trim() || "/"));

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`;
    }
  }, [draft]);

  useEffect(() => {
    setSlashIndex(0);
  }, [draft]);

  useEffect(() => {
    if (!pendingInsert) {
      return;
    }
    const path = useUiStore.getState().consumeInsert();
    if (!path) {
      return;
    }
    setDraft((current) => {
      const at = current.lastIndexOf("@");
      if (at >= 0) {
        return `${current.slice(0, at)}@${path} `;
      }
      return current ? `${current} @${path} ` : `@${path} `;
    });
    textareaRef.current?.focus();
  }, [pendingInsert]);

  useEffect(() => {
    if (!restoredDraft) {
      return;
    }
    const text = useUiStore.getState().consumeRestoredDraft();
    if (!text) {
      return;
    }
    setDraft((current) => (current.trim() ? `${current.trim()}\n${text}` : text));
    textareaRef.current?.focus();
  }, [restoredDraft]);

  const runSlash = async (id: string) => {
    setSlashOpen(false);
    try {
      if (id === "/compact") {
        await client.request("session.compact", {
          instructions: "保留目标、未完成项和关键结论",
        });
        setDraft("");
        return;
      }
      if (id === "/new") {
        await client.request("session.new", { title: "斜杠新建" });
        setDraft("");
        return;
      }
      if (id === "/abort") {
        const response = await client.request("agent.abort", {});
        const restored = (response.payload as { restoredDraft?: string }).restoredDraft;
        useUiStore.getState().consumeRestoredDraft();
        if (restored) {
          setDraft((current) => (current.trim() ? `${current.trim()}\n${restored}` : restored));
        }
      }
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!draft.trim() || sending || connection !== "open") return;
    const mention = parseAgentMention(draft.trim());
    if (mention) {
      void client
        .request("task.delegate", { goal: mention.goal, persona: mention.persona })
        .catch((error) => {
          useUiStore.setState({
            lastError: error instanceof Error ? error.message : String(error),
          });
        });
      setDraft("");
      return;
    }
    if (isRunning) return;
    if (draft.trim().startsWith("/")) {
      const id = slashCommands.find((item) => draft.trim().startsWith(item.id))?.id;
      if (id) {
        void runSlash(id);
        return;
      }
    }
    onSend(draft.trim());
    setDraft("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (slashOpen) {
        setSlashOpen(false);
        return;
      }
      void handleAbort();
      return;
    }
    if (e.key === "@") {
      const next = `${draft}@`;
      if (!next.includes("@agent:")) {
        useUiStore.getState().setCommandOpen(true, "insert");
      }
    }
    if (e.key === "/" && (draft.length === 0 || draft.startsWith("/"))) {
      setSlashOpen(true);
    }
    if (slashOpen && visibleSlash.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIndex((value) => Math.min(value + 1, visibleSlash.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex((value) => Math.max(0, value - 1));
        return;
      }
      if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const selected = visibleSlash[slashIndex] ?? visibleSlash[0];
        if (selected) {
          void runSlash(selected.id);
        }
        return;
      }
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleAbort = async () => {
    try {
      const response = await client.request("agent.abort", {});
      const restored = (response.payload as { restoredDraft?: string }).restoredDraft;
      useUiStore.getState().consumeRestoredDraft();
      if (restored) {
        setDraft((current) => (current.trim() ? `${current.trim()}\n${restored}` : restored));
      }
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleSteer = async () => {
    if (!draft.trim()) return;
    try {
      await client.request("agent.steer", { text: draft.trim() });
      setDraft("");
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleFollowUp = async () => {
    if (!draft.trim()) return;
    try {
      await client.request("agent.followUp", { text: draft.trim() });
      setDraft("");
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const quickPrompts = cwd
    ? ["列出当前目录文件", "解释仓库当前模块划分", "给 README 加一节常见问题"]
    : ["先打开左侧工作区路径", "解析仓库当前模块划分"];

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pb-4 select-none z-10">
      {draft.length === 0 ? (
        <div className="flex items-center gap-1.5 mb-2 overflow-x-auto text-xs text-[#7e7d77]">
          <span className="flex items-center gap-1 text-[#abaaa2] shrink-0 mr-0.5">
            <Sparkles className="w-3 h-3 text-[#abaaa2]" />
            <span>灵感:</span>
          </span>
          {quickPrompts.map((text) => (
            <button
              key={text}
              onClick={() => setDraft(text)}
              className="shrink-0 px-2.5 py-0.5 rounded-full bg-[#edece6]/70 hover:bg-[#e5e4dc] text-[#4f4e4a] hover:text-[#1f1e1d] transition-all text-xs border border-[#00000008]"
            >
              {text}
            </button>
          ))}
        </div>
      ) : null}

      <div className="rounded-2xl border border-[#00000018] bg-[#ffffff] shadow-[0_4px_20px_rgba(0,0,0,0.04)] overflow-hidden focus-within:border-[#00000030] transition-all relative">
        {(slashOpen || draft.startsWith("/")) && visibleSlash.length > 0 ? (
          <div className="absolute bottom-full left-0 right-0 mb-1 rounded-xl border border-[#00000012] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.08)] p-1">
            {visibleSlash.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-[12px] ${
                    index === slashIndex ? "bg-[#f5f4ef]" : "hover:bg-[#f5f4ef]"
                  }`}
                  onMouseEnter={() => setSlashIndex(index)}
                  onClick={() => void runSlash(item.id)}
                >
                  <span className="font-mono text-[#1f1e1d]">{item.id}</span>
                  <span className="ml-2 text-[#7e7d77]">{item.hint}</span>
                </button>
              ))}
          </div>
        ) : null}
        <textarea
          ref={textareaRef}
          rows={2}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setSlashOpen(e.target.value.startsWith("/"));
          }}
          onKeyDown={handleKeyDown}
          disabled={connection !== "open"}
          placeholder={
            connection !== "open"
              ? "等待与后端 Host 建立连接..."
              : !cwd
                ? "先在左侧粘贴工作区路径再开始"
                : isRunning
                  ? "Agent 正在执行… Esc 中止，或插入方向 / 结束后做"
                  : "输入需求，或 @agent:审查者 看这段 diff / Ctrl+Enter 发送..."
          }
          className="w-full bg-transparent px-4 pt-3 pb-2 text-[13.5px] text-[#1f1e1d] placeholder-[#abaaa2] outline-none resize-none leading-relaxed"
        />

        <div className="flex items-center justify-between px-3.5 py-2 bg-[#fdfdfb] border-t border-[#00000008] text-xs text-[#abaaa2]">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#7e7d77] flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-[#edece6] text-[10px] font-mono font-medium text-[#4f4e4a]">Ctrl</kbd>
              +
              <kbd className="px-1.5 py-0.5 rounded bg-[#edece6] text-[10px] font-mono font-medium text-[#4f4e4a]">Enter</kbd>
              发送
              {isRunning ? (
                <span className="ml-2 text-[#abaaa2]">Esc 中止</span>
              ) : null}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {isRunning ? (
              <>
                <button
                  type="button"
                  onClick={handleSteer}
                  disabled={!draft.trim()}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg border border-[#00000012] text-[#4f4e4a] hover:bg-[#edece6] disabled:opacity-30"
                >
                  <CornerDownRight className="w-3 h-3" />
                  插入方向
                </button>
                <button
                  type="button"
                  onClick={handleFollowUp}
                  disabled={!draft.trim()}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg border border-[#00000012] text-[#4f4e4a] hover:bg-[#edece6] disabled:opacity-30"
                >
                  <ListPlus className="w-3 h-3" />
                  结束后做
                </button>
                <button
                  type="button"
                  onClick={handleAbort}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200/60 text-xs transition font-medium"
                >
                  <Square className="w-3 h-3 fill-current" />
                  中止
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={!draft.trim() || sending || connection !== "open" || !cwd}
                className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#1f1e1d] hover:bg-[#0a0a09] text-white disabled:opacity-20 transition-all"
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
