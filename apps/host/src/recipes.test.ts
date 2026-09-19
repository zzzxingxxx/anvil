import { describe, expect, it } from "vitest";
import { draftSkillFromPrompt, resolveMcpIntent } from "./recipes.ts";

describe("recipes", () => {
  it("maps short MCP phrases", () => {
    expect(resolveMcpIntent("GitHub").id).toBe("github");
    expect(resolveMcpIntent("本机文件", "F:/proj").args.at(-1)).toBe("F:/proj");
    expect(resolveMcpIntent("npx -y @modelcontextprotocol/server-memory").command).toBe("npx");
    expect(resolveMcpIntent("npx -y @modelcontextprotocol/server-memory").args).toContain(
      "@modelcontextprotocol/server-memory",
    );
  });

  it("drafts a skill from one sentence", () => {
    const drafted = draftSkillFromPrompt("审查当前 git diff，列出风险");
    expect(drafted.name).toBe("review-diff");
    expect(drafted.description).toContain("审查");
    expect(drafted.body).toContain("git diff");
  });
});
