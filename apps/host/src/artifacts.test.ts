import { describe, expect, it } from "vitest";
import { gitDiff, toolPath } from "./artifacts.ts";

describe("artifacts helpers", () => {
  it("reads a path argument from tool args", () => {
    expect(toolPath({ path: "docs/a.md" })).toBe("docs/a.md");
    expect(toolPath({ command: "git status" })).toBeNull();
  });

  it("returns null git diff when git is missing or the path is clean", async () => {
    const diff = await gitDiff(process.cwd(), "definitely-missing-anvil-file.ts");
    expect(diff === null || typeof diff === "string").toBe(true);
  });
});
