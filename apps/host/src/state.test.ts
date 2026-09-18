import { describe, expect, it } from "vitest";
import { createWorkspaceState, dropExpiredApproval, resetConversation, settleIdleTools, upsertTool } from "./state.ts";

describe("tool snapshot settling", () => {
  it("stamps startedAt and endedAt", () => {
    const state = createWorkspaceState();
    upsertTool(state, { callId: "t1", name: "bash", args: {}, status: "running", output: "" });
    expect(state.tools[0]?.startedAt).toBeTypeOf("number");
    upsertTool(state, { callId: "t1", name: "bash", args: {}, status: "success", output: "ok" });
    expect(state.tools[0]?.endedAt).toBeTypeOf("number");
  });

  it("closes running tools when the agent is idle", () => {
    const state = createWorkspaceState();
    state.agentStatus = "idle";
    upsertTool(state, { callId: "t1", name: "bash", args: {}, status: "running", output: "" });
    settleIdleTools(state);
    expect(state.tools[0]?.status).toBe("error");
    expect(state.tools[0]?.endedAt).toBeTypeOf("number");
  });
});

describe("resetConversation", () => {
  it("zeros usage so a new session does not inherit the previous turn", () => {
    const state = createWorkspaceState();
    state.usage = { inputTokens: 12, outputTokens: 8, cacheReadTokens: 3, costUsd: 0.02 };
    resetConversation(state);
    expect(state.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
  });
});

describe("dropExpiredApproval", () => {
  it("drops a timed-out approval so snapshot cannot revive it", () => {
    const state = createWorkspaceState();
    state.pendingApproval = {
      requestId: "appr-old",
      toolName: "bash",
      argsPreview: "git status",
      risk: "medium",
      expiresAt: Date.now() - 1,
    };
    dropExpiredApproval(state);
    expect(state.pendingApproval).toBeNull();
  });
});
