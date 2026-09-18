import { describe, expect, it } from "vitest";
import { ApprovalQueue } from "./approvals.ts";

describe("ApprovalQueue", () => {
  it("times out as deny", async () => {
    const queue = new ApprovalQueue(20);
    const decision = await queue.wait({
      requestId: "appr-timeout",
      toolName: "bash",
      argsPreview: "git status",
      risk: "medium",
    });
    expect(decision).toBe("deny");
    expect(queue.current).toBeNull();
  });

  it("stamps expiresAt on the request", async () => {
    const queue = new ApprovalQueue(5_000);
    const request = {
      requestId: "appr-stamp",
      toolName: "bash",
      argsPreview: "ls",
      risk: "low" as const,
    };
    const pending = queue.wait(request);
    expect(request.expiresAt).toBeGreaterThan(Date.now());
    queue.respond("appr-stamp", "deny");
    await pending;
  });
});
