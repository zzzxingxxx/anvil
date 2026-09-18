import { describe, expect, it } from "vitest";
import { probeDocker } from "./docker.ts";

describe("probeDocker", () => {
  it("returns a status object without throwing", async () => {
    const status = await probeDocker();
    expect(typeof status.available).toBe("boolean");
    if (!status.available) {
      expect(status.reason).toBeTruthy();
    }
  });
});
