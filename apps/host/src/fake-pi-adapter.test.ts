import { describe, expect, it } from "vitest";
import type { AnvilEvent } from "@anvil/protocol";
import { ApprovalQueue } from "./approvals.ts";
import { FakePiAdapter } from "./fake-pi-adapter.ts";
import { createWorkspaceState } from "./state.ts";

describe("FakePiAdapter", () => {
  it("emits a prompt loop that ends idle", async () => {
    const state = createWorkspaceState();
    state.trust = "trusted";
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    const events: AnvilEvent["type"][] = [];
    adapter.subscribe((event) => {
      events.push(event.type);
      if (event.type === "approval/needed") {
        approvals.respond(event.request.requestId, "allow-once");
      }
    });
    await adapter.prompt({ text: "你好" });
    expect(events[0]).toBe("agent/running");
    expect(events).toContain("message/upsert");
    expect(events).toContain("tool/start");
    expect(events).toContain("approval/needed");
    expect(events).toContain("tool/end");
    expect(events.at(-1)).toBe("agent/idle");
    expect(state.messages.some((message) => message.role === "user")).toBe(true);
    expect(state.tools[0]?.name).toBe("bash");
    expect(state.tools[0]?.status).toBe("success");
  });

  it("denies bash in untrusted workspaces", async () => {
    const state = createWorkspaceState();
    state.trust = "untrusted";
    const approvals = new ApprovalQueue();
    const adapter = new FakePiAdapter(state, approvals);
    await adapter.prompt({ text: "列出文件" });
    expect(state.tools[0]?.status).toBe("error");
    expect(state.tools[0]?.output).toMatch(/未信任/);
  });
});
