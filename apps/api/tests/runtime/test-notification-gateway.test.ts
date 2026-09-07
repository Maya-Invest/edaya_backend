import { noOpNotificationGateway } from "@edaya/core";
import { describe, expect, it } from "bun:test";
import { createPgliteTestEnv } from "../support/pglite-env";
import {
  isNotifyConfigured,
  resolveNotificationGateway,
} from "@/runtime/shared/adapters/notification-gateway";

describe("isNotifyConfigured", () => {
  it("is false on the in-memory runtime", () => {
    expect(isNotifyConfigured(createPgliteTestEnv())).toBe(false);
  });

  it("is false when Novu is configured", () => {
    expect(isNotifyConfigured(createPgliteTestEnv({
      RUNTIME: "local",
      DATABASE_URL: "pglite:.data/school",
      NOVU_SECRET_KEY: "novu-test-key",
    }))).toBe(false);
  });

  it("is true on local and worker when Novu is not set", () => {
    expect(isNotifyConfigured(createPgliteTestEnv({
      RUNTIME: "local",
      DATABASE_URL: "pglite:.data/school",
    }))).toBe(true);
    expect(isNotifyConfigured(createPgliteTestEnv({
      RUNTIME: "worker",
      DATABASE_URL: "postgres://localhost/edaya",
    }))).toBe(true);
  });
});

describe("resolveNotificationGateway", () => {
  it("no-ops on the in-memory runtime even when Novu is set", () => {
    const env = createPgliteTestEnv({
      NOVU_SECRET_KEY: "novu-test-key",
    });

    expect(resolveNotificationGateway(env)).toBe(noOpNotificationGateway);
  });
});
