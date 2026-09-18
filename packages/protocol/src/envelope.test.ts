import { describe, expect, it } from "vitest";
import { CommandPayloadSchemas, CommandTypeSchema } from "./commands.ts";
import { AnvilEventSchema } from "./events.ts";
import { EnvelopeSchema, makeEvent, makeRequest, makeResponse } from "./envelope.ts";

describe("protocol envelope", () => {
  it("parses request/response/event envelopes", () => {
    const req = makeRequest("agent.prompt", { text: "你好" }, "req-1");
    const res = makeResponse("req-1", "agent.prompt", { ok: true });
    const ev = makeEvent("heartbeat", { type: "heartbeat", ts: 1 }, "ev-1");
    expect(EnvelopeSchema.parse(req).kind).toBe("req");
    expect(EnvelopeSchema.parse(res).kind).toBe("res");
    expect(EnvelopeSchema.parse(ev).kind).toBe("ev");
  });

  it("covers the phase-4 commands", () => {
    const types = CommandTypeSchema.options;
    expect(types).toHaveLength(27);
    for (const type of types) {
      expect(CommandPayloadSchemas[type]).toBeDefined();
    }
  });

  it("parses a fake tool loop as AnvilEvent", () => {
    const events = [
      { type: "agent/running" },
      {
        type: "message/upsert",
        message: { id: "m1", role: "user", text: "你好", createdAt: 1 },
      },
      {
        type: "tool/start",
        callId: "t1",
        name: "bash",
        args: { command: "git status" },
      },
      { type: "tool/end", callId: "t1", ok: true, result: "clean" },
      { type: "agent/idle" },
    ];
    for (const event of events) {
      expect(AnvilEventSchema.parse(event).type).toBe(event.type);
    }
  });
});
