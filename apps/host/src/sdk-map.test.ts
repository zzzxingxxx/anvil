import { describe, expect, it } from "vitest";
import { AnvilEventSchema } from "@anvil/protocol";
import { eventFromSdk, toUiMessage } from "./sdk-map.ts";

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
    expect(AnvilEventSchema.parse({ type: "message/upsert", message: ui }).type).toBe("message/upsert");
  });
});
