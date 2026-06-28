import { afterEach, describe, expect, it, mock } from "bun:test";
import { probeR2EndpointReachable } from "../src/probe-r2-endpoint";

describe("probeR2EndpointReachable", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns true when fetch completes with any HTTP response", async () => {
    globalThis.fetch = mock(async () => new Response(null, { status: 403 })) as typeof fetch;

    await expect(probeR2EndpointReachable("https://test-account-id.r2.cloudflarestorage.com")).resolves.toBe(true);
  });

  it("returns false when fetch throws", async () => {
    globalThis.fetch = mock(async () => {
      throw new Error("ConnectionRefused");
    }) as typeof fetch;

    await expect(probeR2EndpointReachable("https://test-account-id.r2.cloudflarestorage.com")).resolves.toBe(false);
  });
});
