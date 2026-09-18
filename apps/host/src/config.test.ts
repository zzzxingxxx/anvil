import { afterEach, describe, expect, it } from "vitest";
import { chooseAdapterKind, useRpcPi } from "./config.ts";

describe("adapter selection", () => {
  const previousFake = process.env.ANVIL_FAKE_PI;
  const previousMode = process.env.ANVIL_PI_MODE;
  const previousVitest = process.env.VITEST;
  const previousNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    restore("ANVIL_FAKE_PI", previousFake);
    restore("ANVIL_PI_MODE", previousMode);
    restore("VITEST", previousVitest);
    restore("NODE_ENV", previousNodeEnv);
  });

  it("keeps SDK unless ANVIL_PI_MODE is rpc or auto", () => {
    process.env.ANVIL_FAKE_PI = "0";
    process.env.VITEST = "false";
    process.env.NODE_ENV = "production";
    delete process.env.ANVIL_PI_MODE;
    expect(chooseAdapterKind("untrusted")).toBe("sdk");
    process.env.ANVIL_PI_MODE = "rpc";
    expect(useRpcPi("trusted")).toBe(true);
    process.env.ANVIL_PI_MODE = "auto";
    expect(useRpcPi("untrusted")).toBe(true);
    expect(useRpcPi("trusted")).toBe(false);
  });
});

function restore(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
