import { useEffect, useRef, useState } from "react";
import { client } from "./ws.ts";
import { useUiStore } from "./store.ts";
import { Header } from "./components/Header.tsx";
import { Sidebar } from "./components/Sidebar.tsx";
import { Footer } from "./components/Footer.tsx";
import { Composer } from "./components/Composer.tsx";
import { MessageItem } from "./components/MessageItem.tsx";
import { ToolItem } from "./components/ToolItem.tsx";
import { Inspector } from "./components/Inspector.tsx";
import { ApprovalCard } from "./components/ApprovalCard.tsx";
import { CommandPalette } from "./components/CommandPalette.tsx";
import { TaskTray } from "./components/TaskTray.tsx";
import { Board } from "./components/Board.tsx";
import { SettingsPage } from "./components/SettingsPage.tsx";

export function App() {
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const { messages, tools, lastError, cwd, sessions, activeTab } = useUiStore();

  useEffect(() => {
    client.connect();
    return () => client.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        useUiStore.getState().setCommandOpen(true, "search");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (stickToBottom.current && listRef.current) {
      listRef.current.scrollTo({ 
        top: listRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [messages, tools]);

  const handleSend = async (text: string) => {
    setSending(true);
    try {
      await client.request("agent.prompt", { text });
    } catch (error) {
      useUiStore.setState({
        lastError: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col bg-[#faf9f5] text-[#1f1e1d] overflow-hidden select-none antialiased">
      {/* Top Header */}
      <Header />

      {/* Main Workspace Stage */}
      <div className="flex min-h-0 flex-1 overflow-hidden relative">
        {/* Left Sidebar */}
        <Sidebar />

        {/* Central Workspace Stage */}
        <main className="flex min-h-0 flex-1 flex-col bg-[#faf9f5] relative overflow-hidden">
          {activeTab === "board" ? <Board /> : null}
          {activeTab === "settings" ? <SettingsPage /> : null}
          {activeTab === "chat" ? (
          <>
          <div
            ref={listRef}
            className="min-h-0 flex-1 overflow-y-auto px-4 py-8 select-text flex flex-col items-center"
            onScroll={(e) => {
              const el = e.currentTarget;
              stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 70;
            }}
          >
            <div className="w-full max-w-2xl space-y-4">
              {messages.length === 0 && tools.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto p-6 select-none pt-16">
                  <div className="w-10 h-10 rounded-2xl bg-[#ffffff] border border-[#00000010] shadow-[0_2px_6px_rgba(0,0,0,0.03)] flex items-center justify-center mb-3 text-[#1f1e1d] font-serif font-bold text-base">
                    π
                  </div>
                  <h3 className="font-semibold text-[#1f1e1d] text-sm mb-1.5 tracking-tight">
                    {cwd ? "工作区已打开" : "先打开一个本机仓库"}
                  </h3>
                  <p className="text-xs text-[#7e7d77] leading-relaxed mb-4">
                    浏览器不能弹系统文件框。请在左侧粘贴路径，例如本仓库。
                  </p>
                  <div className="grid gap-2 w-full text-left">
                    <StartCard
                      title="解释这个仓库"
                      detail="打开工作区后，让 Agent 只读梳理模块。"
                      prompt="解释当前仓库的模块划分，不要改文件。"
                      disabled={!cwd}
                    />
                    <StartCard
                      title="修一个小问题"
                      detail="信任模式 + 审批后，才能 write / bash。"
                      prompt="帮我给 README 加一节「常见问题」，先说明你打算改哪里。"
                      disabled={!cwd}
                    />
                    <StartCard
                      title="恢复上次会话"
                      detail={sessions[0] ? sessions[0].title : "还没有可恢复的会话"}
                      disabled={!sessions[0]}
                      onClick={
                        sessions[0]
                          ? async () => {
                              await client.request("session.resume", { id: sessions[0]!.id });
                            }
                          : undefined
                      }
                    />
                  </div>
                </div>
              ) : null}

              {/* Message List */}
              {messages.map((message) => (
                <MessageItem key={message.id} message={message} />
              ))}

              {/* Tool Execution Cards */}
              {tools.map((tool) => (
                <ToolItem key={tool.callId} tool={tool} />
              ))}
            </div>
          </div>

          <TaskTray />
          <ApprovalCard />
          <Composer onSend={handleSend} sending={sending} />
          </>
          ) : null}

          {/* Toast / Error Banner */}
          {lastError ? <ErrorBanner message={lastError} /> : null}
        </main>

        {/* Right Inspector Drawer */}
        <Inspector />
      </div>

      {/* Global Status Footer */}
      <Footer />
      <CommandPalette />
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  const [open, setOpen] = useState(false);
  const short = message.length > 80 ? `${message.slice(0, 80)}…` : message;
  const long = message.length > 80;
  return (
    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 px-3.5 py-2 bg-[#ffffff] border border-rose-200 text-rose-800 text-xs rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] flex items-start gap-3 max-w-lg">
      <div className="min-w-0">
        <div>{open || !long ? message : short}</div>
        {long ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="mt-1 text-[11px] text-rose-600 hover:text-rose-900 underline"
          >
            {open ? "收起详情" : "详情"}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => useUiStore.setState({ lastError: null })}
        className="text-rose-600 hover:text-rose-900 text-[11px] underline shrink-0"
      >
        关闭
      </button>
    </div>
  );
}

function StartCard({
  title,
  detail,
  prompt,
  disabled,
  onClick,
}: {
  title: string;
  detail: string;
  prompt?: string;
  disabled?: boolean;
  onClick?: () => Promise<void>;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={async () => {
        if (onClick) {
          try {
            await onClick();
          } catch (error) {
            useUiStore.setState({
              lastError: error instanceof Error ? error.message : String(error),
            });
          }
          return;
        }
        if (prompt) {
          try {
            await client.request("agent.prompt", { text: prompt });
          } catch (error) {
            useUiStore.setState({
              lastError: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }}
      className="rounded-xl border border-[#00000010] bg-white px-3.5 py-3 text-left disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#00000022]"
    >
      <div className="text-xs font-medium text-[#1f1e1d]">{title}</div>
      <div className="text-[11px] text-[#7e7d77] mt-0.5">{detail}</div>
    </button>
  );
}
