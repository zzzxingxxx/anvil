import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listConfiguredModels,
  mergeModelLists,
  modelsUrl,
  normalizeOpenAiBaseUrl,
  providerIdFromUrl,
  uniqueProviderId,
  upsertPiProvider,
} from "./pi-models.ts";

describe("pi-models", () => {
  const previous = process.env.PI_CODING_AGENT_DIR;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = previous;
    }
  });

  it("normalizes OpenAI-compatible URLs", () => {
    expect(normalizeOpenAiBaseUrl("https://xywxing.xyz/v1")).toBe("https://xywxing.xyz/v1");
    expect(normalizeOpenAiBaseUrl("https://xywxing.xyz/v1/")).toBe("https://xywxing.xyz/v1");
    expect(normalizeOpenAiBaseUrl("https://xywxing.xyz/v1/models")).toBe("https://xywxing.xyz/v1");
    expect(modelsUrl("https://xywxing.xyz/v1")).toBe("https://xywxing.xyz/v1/models");
    expect(providerIdFromUrl("https://xywxing.xyz/v1")).toBe("xywxing-xyz-v1");
    expect(uniqueProviderId("xywxing-xyz-v1", new Set(["xywxing-xyz-v1"]))).toBe("xywxing-xyz-v1-2");
  });

  it("writes a provider into local models.json without BOM", async () => {
    const dir = await mkdtemp(join(tmpdir(), "anvil-pi-agent-"));
    process.env.PI_CODING_AGENT_DIR = dir;
    await upsertPiProvider({
      provider: "xywxing-xyz",
      baseUrl: "https://xywxing.xyz/v1",
      apiKey: "sk-test",
      models: [{ id: "gemini-3.8-flash-high", name: "gemini-3.8-flash-high" }],
    });
    const raw = await readFile(join(dir, "models.json"), "utf8");
    expect(raw.startsWith("{")).toBe(true);
    const parsed = JSON.parse(raw) as {
      providers: Record<string, { baseUrl?: string; models?: Array<{ id: string }> }>;
    };
    expect(parsed.providers["xywxing-xyz"]?.baseUrl).toBe("https://xywxing.xyz/v1");
    expect(parsed.providers["xywxing-xyz"]?.models?.[0]?.id).toBe("gemini-3.8-flash-high");
    const listed = await listConfiguredModels();
    expect(listed).toEqual([
      {
        id: "xywxing-xyz/gemini-3.8-flash-high",
        label: "gemini-3.8-flash-high",
        provider: "xywxing-xyz",
      },
    ]);
  });

  it("merges configured models without dropping either list", () => {
    expect(
      mergeModelLists(
        [{ id: "a/one", label: "one", provider: "a" }],
        [
          { id: "a/one", label: "one", provider: "a" },
          { id: "b/two", label: "two", provider: "b" },
        ],
      ).map((item) => item.id),
    ).toEqual(["a/one", "b/two"]);
  });
});
