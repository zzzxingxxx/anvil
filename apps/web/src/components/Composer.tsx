import { ArrowUp, Square, Sparkles, CornerDownRight, ListPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useUiStore } from "../store.ts";
import { client } from "../ws.ts";

interface ComposerProps {
  onSend: (text: string) => Promise<void>;
  sending: boolean;
}

export function Composer({ onSend, sending }: ComposerProps) {
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { agentStatus, connection, cwd } = useUiStore();
  const isRunning = agentStatus === "running";

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`;
    }
  }, [draft]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!draft.trim() || sending || connection !== "open" || isRunning) return;
    onSend(draft.trim());
    setDraft("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      void handleAbort();
      return;
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleAbort = async () => {
    try {
      await client.request("agent.abort", {});
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

      <div className="rounded-2xl border border-[#00000018] bg-[#ffffff] shadow-[0_4px_20px_rgba(0,0,0,0.04)] overflow-hidden focus-within:border-[#00000030] transition-all">
        <textarea
          ref={textareaRef}
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={connection !== "open"}
          placeholder={
            connection !== "open"
              ? "等待与后端 Host 建立连接..."
              : !cwd
                ? "先在左侧粘贴工作区路径再开始"
                : isRunning
                  ? "Agent 正在执行… Esc 中止，或插入方向 / 结束后做"
                  : "输入需求或指令，按 Ctrl + Enter 发送..."
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
