import { describe, expect, it, vi } from "vitest";
import { logInfo } from "./log.ts";

describe("log redaction", () => {
  it("does not print api keys", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    logInfo("boot", { token: "sk-secret-value" });
    const printed = String(spy.mock.calls[0]?.[0] ?? "");
    expect(printed).not.toMatch(/sk-secret-value/);
    spy.mockRestore();
  });

  it("redacts bare sk- keys in free text", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    logInfo("prompt sk-ant-abcdefghijklmnopqrstuvwxyz");
    const printed = String(spy.mock.calls[0]?.[0] ?? "");
    expect(printed).not.toMatch(/sk-ant-abcdefghijklmnopqrstuvwxyz/);
    expect(printed).toMatch(/sk-\*\*\*/);
    spy.mockRestore();
  });
});
