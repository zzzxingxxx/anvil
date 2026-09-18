import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { exportUsage, recordUsage } from "./usage-ledger.ts";

describe("usage ledger", () => {
  const previousHome = process.env.ANVIL_HOME;

  beforeEach(async () => {
    process.env.ANVIL_HOME = await mkdtemp(join(tmpdir(), "anvil-usage-"));
  });

  afterEach(() => {
    if (previousHome === undefined) {
      delete process.env.ANVIL_HOME;
    } else {
      process.env.ANVIL_HOME = previousHome;
    }
  });

  it("exports a local week summary without uploading", async () => {
    await recordUsage({
      inputTokens: 12,
      outputTokens: 4,
      cacheReadTokens: 3,
      cacheWriteTokens: 1,
      costUsd: 0.001,
    });
    const exported = await exportUsage("sess.jsonl");
    expect(exported.text).toContain("未上传");
    expect(exported.text).toContain("input: 12");
    expect(exported.text).toContain("cacheRead: 3");
    expect(exported.text).toContain("cacheWrite: 1");
    expect(exported.text).toContain("sess.jsonl");
    expect(exported.days[0]?.inputTokens).toBe(12);
    expect(exported.days[0]?.cacheReadTokens).toBe(3);
  });
});
