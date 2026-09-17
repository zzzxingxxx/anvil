import { describe, expect, it } from "vitest";
import { FileLockTable } from "./locks.ts";
import { canDelegate } from "./policy.ts";

describe("file locks", () => {
  it("rejects a second writer on the same path", () => {
    const locks = new FileLockTable();
    expect(locks.tryLock("a", "src/index.ts").ok).toBe(true);
    const second = locks.tryLock("b", "SRC\\index.ts");
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.owner).toBe("a");
    }
    locks.release("a");
    expect(locks.tryLock("b", "src/index.ts").ok).toBe(true);
  });
});

describe("delegate policy", () => {
  it("blocks nested delegate and untrusted writers", () => {
    expect(
      canDelegate({
        goal: "x",
        persona: "implementer",
        trust: "trusted",
        parentIsChild: true,
        runningCount: 0,
        workspaceRoot: "C:\\repo",
      }).ok,
    ).toBe(false);
    expect(
      canDelegate({
        goal: "x",
        persona: "implementer",
        trust: "untrusted",
        parentIsChild: false,
        runningCount: 0,
        workspaceRoot: "C:\\repo",
      }).ok,
    ).toBe(false);
    expect(
      canDelegate({
        goal: "x",
        persona: "reviewer",
        cwd: "../secret",
        trust: "trusted",
        parentIsChild: false,
        runningCount: 0,
        workspaceRoot: "C:\\repo",
      }).ok,
    ).toBe(false);
  });
});
