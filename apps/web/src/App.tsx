import { useEffect, useRef, useState } from "react";
import { WifiOff, LoaderCircle } from "lucide-react";
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
import { EmptyState } from "./components/EmptyState.tsx";
import { WorkspaceWelcome } from "./components/WorkspaceWelcome.tsx";

export function App() {
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const { messages, tools, lastError, cwd, sessions, activeTab, connection, agentStatus } = useUiStore();

  useEffect(() => {
    client.connect();
    const wideSidebar = window.matchMedia("(min-width: 1024px)");
    useUiStore.setState({
      sidebarOpen: wideSidebar.matches,
      inspectorOpen: false,
    });
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
        behavior: "smooth",
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

  const empty = messages.length === 0 && tools.length === 0;
  const connecting = connection === "connecting";
  const offline = connection === "closed";

  return (
    <div className="flex h-screen w-screen flex-col bg-[#faf9f5] text-[#1f1e1d] overflow-hidden select-none antialiased">
      <Header />

      <div className="flex min-h-0 flex-1 overflow-hidden relative">
        <Sidebar />

        <main className="flex min-h-0 flex-1 flex-col bg-[#faf9f5] relative overflow-hidden">
          {activeTab === "board" ? (
            <div className="min-h-0 flex-1 overflow-hidden">
              <Board />
            </div>
          ) : null}
          {activeTab === "settings" ? (
            <div className="min-h-0 flex-1 h-full overflow-hidden flex flex-col">
              <SettingsPage />
            </div>
          ) : null}
          {activeTab === "chat" ? (
            <>
              <div
                ref={listRef}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 sm:px-6 py-6 sm:py-8 select-text flex flex-col items-center"
                onScroll={(e) => {
                  const el = e.currentTarget;
                  stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 70;
                }}
              >
                <div className="w-full max-w-2xl space-y-4 min-h-full flex flex-col">
                  {connecting && empty ? (
                    <EmptyState
                      className="flex-1"
                      icon={<LoaderCircle className="w-5 h-5 text-[#7e7d77] animate-spin" />}
                      title="正在连接 Host"
                      detail="等待 127.0.0.1:4317 上的工作台就绪。"
                    />
                  ) : null}

                  {offline && empty ? (
                    <EmptyState
                      className="flex-1"
                      icon={<WifiOff className="w-5 h-5 text-[#7e7d77]" />}
                      title="Host 离线"
                      detail="对话、审批和工作区都走本机 Host。请确认 Anvil Host 已启动，页面会自动重连。"
                    />
                  ) : null}

                  {!connecting && !offline && empty ? (
                    <WorkspaceWelcome onSelectPrompt={(prompt) => void handleSend(prompt)} />
                  ) : null}

                  {messages.map((message) => (
                    <MessageItem key={message.id} message={message} />
                  ))}

                  {tools.map((tool) => (
                    <ToolItem key={tool.callId} tool={tool} />
                  ))}

                  {agentStatus === "running" && tools.every((tool) => tool.status !== "running") ? (
                    <div className="flex items-center gap-2 px-1 text-[11px] text-[#7e7d77]">
                      <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                      <span>Agent 正在思考…</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <TaskTray />
              <ApprovalCard />
              <Composer onSend={handleSend} sending={sending} />
            </>
          ) : null}

        </main>

        <Inspector />
      </div>

      {lastError ? <ErrorBanner message={lastError} /> : null}
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
    <div
      role="alert"
      className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-3.5 py-2 bg-[#ffffff] border border-rose-200 text-rose-800 text-xs rounded-xl shadow-[var(--shadow-float)] flex items-start gap-3 max-w-[min(32rem,calc(100vw-2rem))]"
    >
      <div className="min-w-0">
        <div className="font-medium mb-0.5">出错了</div>
        <div className="whitespace-pre-wrap break-words">{open || !long ? message : short}</div>
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
