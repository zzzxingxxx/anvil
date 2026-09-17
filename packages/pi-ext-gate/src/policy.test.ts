import { describe, expect, it } from "vitest";
import { decideGate } from "./policy.ts";

describe("decideGate", () => {
  it("denies write/bash in untrusted workspaces", () => {
    expect(
      decideGate({ toolName: "bash", args: { command: "git status" }, trust: "untrusted" }).decision,
    ).toBe("deny");
    expect(
      decideGate({ toolName: "write", args: { path: "README.md" }, trust: "untrusted" }).decision,
    ).toBe("deny");
  });

  it("asks for bash in trusted workspaces", () => {
    expect(
      decideGate({ toolName: "bash", args: { command: "git status" }, trust: "trusted" }).decision,
    ).toBe("ask");
  });

  it("always denies high-risk commands when untrusted", () => {
    expect(
      decideGate({
        toolName: "bash",
        args: { command: "rm -rf node_modules" },
        trust: "untrusted",
      }).decision,
    ).toBe("deny");
  });

  it("asks for high-risk commands when trusted", () => {
    expect(
      decideGate({
        toolName: "bash",
        args: { command: "git push origin main" },
        trust: "trusted",
      }).decision,
    ).toBe("ask");
  });

  it("allows read tools", () => {
    expect(decideGate({ toolName: "read", args: { path: "README.md" }, trust: "untrusted" }).decision).toBe(
      "allow",
    );
  });
});
