import { describe, expect, it } from "vitest";
import { applyPiSessionEvent } from "./sdk-events.ts";
import { createWorkspaceState } from "./state.ts";

describe("applyPiSessionEvent", () => {
  it("maps RPC message_update without a top-level message via partial", () => {
    const state = createWorkspaceState("rpc");
    const emitted: string[] = [];
    applyPiSessionEvent(
      state,
      {
        type: "message_update",
        assistantMessageEvent: {
          type: "text_delta",
          delta: "正在读取仓库",
          partial: {
            id: "msg-rpc",
            role: "assistant",
            timestamp: 1_700_000_000_000,
            content: [{ type: "text", text: "正在读取仓库" }],
          },
        },
      },
      (event) => emitted.push(event.type),
    );
    expect(state.messages.some((item) => item.text === "正在读取仓库")).toBe(true);
    expect(emitted).toContain("message/upsert");
  });

  it("maps tool start and end onto workspace tools", () => {
    const state = createWorkspaceState("rpc");
    applyPiSessionEvent(
      state,
      { type: "tool_execution_start", toolCallId: "t1", toolName: "bash", args: { command: "git status" } },
      () => undefined,
    );
    applyPiSessionEvent(
      state,
      { type: "tool_execution_end", toolCallId: "t1", toolName: "bash", result: "ok", isError: false },
      () => undefined,
    );
    expect(state.tools[0]).toMatchObject({ callId: "t1", name: "bash", status: "success", output: "ok" });
  });
});
