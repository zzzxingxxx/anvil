import { describe, expect, it } from "vitest";
import { createWorkspaceState, settleIdleTools, upsertTool } from "./state.ts";

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
