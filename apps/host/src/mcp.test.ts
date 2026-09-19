import { describe, expect, it } from "vitest";
import { isMcpToolName, sanitizeServers } from "./mcp.ts";

describe("mcp config", () => {
  it("keeps unique valid servers", () => {
    expect(
      sanitizeServers([
        { id: "github", name: "GitHub", command: "npx", args: ["-y", "@modelcontextprotocol/server-github"] },
        { id: "github", name: "dup", command: "npx" },
        { id: " ", name: "bad", command: "npx" },
      ]),
    ).toEqual([
      {
        id: "github",
        name: "GitHub",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-github"],
        env: undefined,
        enabled: true,
      },
    ]);
  });

  it("detects MCP tool names", () => {
    expect(isMcpToolName("mcp__github__search")).toBe(true);
    expect(isMcpToolName("bash")).toBe(false);
  });
});
