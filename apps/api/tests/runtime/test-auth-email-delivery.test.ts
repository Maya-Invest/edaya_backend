import { describe, expect, it } from "bun:test";
import { createPgliteTestEnv } from "../support/pglite-env";
import {
  isAuthEmailDeliveryConfigured,
  resolveAuthEmailDelivery,
} from "@/runtime/shared/adapters/auth-email-delivery";

describe("resolveAuthEmailDelivery", () => {
  it("does not use Novu or notify on the in-memory runtime", () => {
    const env = createPgliteTestEnv({
      NOVU_SECRET_KEY: "novu-test-key",
    });

    expect(isAuthEmailDeliveryConfigured(env)).toBe(false);
    expect(resolveAuthEmailDelivery(env)).toEqual({ mode: "log", port: null });
  });

  it("uses Novu on the local runtime when configured", () => {
    const resolved = resolveAuthEmailDelivery(createPgliteTestEnv({
      RUNTIME: "local",
      DATABASE_URL: "pglite:.data/school",
      NOVU_SECRET_KEY: "novu-test-key",
    }));

    expect(resolved.mode).toBe("novu");
    expect(resolved.port).not.toBeNull();
  });

  it("uses in-process notify on the local runtime when Novu is not set", () => {
    const resolved = resolveAuthEmailDelivery(createPgliteTestEnv({
      RUNTIME: "local",
      DATABASE_URL: "pglite:.data/school",
    }));

    expect(resolved.mode).toBe("notify");
    expect(resolved.port).not.toBeNull();
  });
});
