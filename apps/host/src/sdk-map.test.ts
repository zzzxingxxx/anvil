import { describe, expect, it } from "vitest";
import { AnvilEventSchema } from "@anvil/protocol";
import { eventFromSdk, toUiMessage, usageFromSessionStats } from "./sdk-map.ts";

describe("sdk event mapping", () => {
  it("maps agent_start and agent_end", () => {
    expect(eventFromSdk({ type: "agent_start" })).toEqual({ type: "agent/running" });
    expect(eventFromSdk({ type: "agent_end" })).toEqual({ type: "agent/idle" });
  });

  it("maps a message_update fixture to message/upsert", () => {
    const fixture = {
      type: "message_update",
      message: {
        id: "msg-1",
        role: "assistant",
        timestamp: 1_700_000_000_000,
        content: [{ type: "text", text: "正在读取仓库" }],
      },
    };
    const ui = toUiMessage(fixture.message, true);
    expect(ui).toMatchObject({
      id: "msg-1",
      role: "assistant",
      text: "正在读取仓库",
      streaming: true,
    });
    expect(toUiMessage(fixture.message, false, "entry-9")?.id).toBe("entry-9");
    expect(AnvilEventSchema.parse({ type: "message/upsert", message: ui }).type).toBe("message/upsert");
  });

  it("maps sidecar session stats onto Anvil usage", () => {
    expect(
      usageFromSessionStats({
        tokens: { input: 12, output: 34, cacheRead: 5, cacheWrite: 7 },
        cost: 0.0123,
      }),
    ).toEqual({
      inputTokens: 12,
      outputTokens: 34,
      cacheReadTokens: 5,
      cacheWriteTokens: 7,
      costUsd: 0.0123,
    });
  });
});
