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

  it("asks for commands outside the bash allowlist", () => {
    expect(
      decideGate({
        toolName: "bash",
        args: { command: "ls" },
        trust: "trusted",
        bashPolicy: "allowlist",
        bashAllowlist: ["git status"],
      }).decision,
    ).toBe("ask");
  });

  it("denies tools outside a persona allowlist", () => {
    expect(
      decideGate({
        toolName: "bash",
        args: { command: "git status" },
        trust: "trusted",
        allowedTools: ["read", "grep", "find", "ls"],
      }),
    ).toMatchObject({ decision: "deny" });
    expect(
      decideGate({
        toolName: "read",
        args: { path: "README.md" },
        trust: "untrusted",
        allowedTools: ["read", "grep", "find", "ls"],
      }).decision,
    ).toBe("allow");
  });

  it("asks before the agent adds MCP or Skill", () => {
    expect(
      decideGate({
        toolName: "anvil_add_mcp",
        args: { text: "GitHub" },
        trust: "untrusted",
      }).decision,
    ).toBe("ask");
    expect(
      decideGate({
        toolName: "anvil_add_skill",
        args: { prompt: "审查 diff" },
        trust: "trusted",
        mcpAllowed: false,
      }).decision,
    ).toBe("deny");
  });

  it("asks for MCP tools only in trusted workspaces", () => {
    expect(
      decideGate({
        toolName: "mcp__github__search",
        args: { q: "anvil" },
        trust: "untrusted",
      }).decision,
    ).toBe("deny");
    expect(
      decideGate({
        toolName: "mcp__github__search",
        args: { q: "anvil" },
        trust: "trusted",
      }).decision,
    ).toBe("ask");
    expect(
      decideGate({
        toolName: "mcp__github__search",
        args: { q: "anvil" },
        trust: "trusted",
        mcpAllowed: false,
      }).decision,
    ).toBe("deny");
  });

  it("allows commands on the bash allowlist", () => {
    expect(
      decideGate({
        toolName: "bash",
        args: { command: "git status" },
        trust: "trusted",
        bashPolicy: "allowlist",
        bashAllowlist: ["git status"],
      }).decision,
    ).toBe("allow");
  });
});
