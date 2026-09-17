import { describe, expect, it } from "vitest";
import { unifiedDiff } from "./store.ts";

describe("unifiedDiff", () => {
  it("marks added and removed lines", () => {
    const diff = unifiedDiff("a.ts", "hello\nworld", "hello\nthere");
    expect(diff).toContain("-world");
    expect(diff).toContain("+there");
    expect(diff).toContain(" hello");
  });
});
