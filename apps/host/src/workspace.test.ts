import { describe, expect, it } from "vitest";
import { looksText } from "./workspace.ts";

describe("looksText", () => {
  it("treats shell scripts and anvil.cmd as previewable", () => {
    expect(looksText("anvil.cmd")).toBe(true);
    expect(looksText("scripts/setup.ps1")).toBe(true);
    expect(looksText("bin/start.sh")).toBe(true);
    expect(looksText("README")).toBe(true);
    expect(looksText("photo.bin")).toBe(false);
  });
});
