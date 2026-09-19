import { describe, expect, it } from "vitest";
import { envKeysOf, isMcpToolName, mergeEnv, sanitizeServers, stripEnvForProject } from "./mcp.ts";

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

  it("merges env patches without echoing blanks as deletes", () => {
    const merged = mergeEnv({ GITHUB_TOKEN: "old", KEEP: "1" }, { GITHUB_TOKEN: "new", KEEP: "" });
    expect(merged).toEqual({ GITHUB_TOKEN: "new" });
    expect(envKeysOf(merged)).toEqual(["GITHUB_TOKEN"]);
    expect(stripEnvForProject([{ id: "github", name: "github", command: "npx", env: merged }])[0]).not.toHaveProperty(
      "env",
    );
  });
});
