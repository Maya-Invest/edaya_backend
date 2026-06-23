import { describe, expect, test } from "bun:test";
import { parseRuntimeEnv } from "@/runtime/env/schema";

describe("cron runtime env", () => {
  test("parses node bindings with defaults", () => {
    const env = parseRuntimeEnv({
      RUNTIME: "node",
      DATABASE_URL: "pglite",
    });

    expect(env.RUNTIME).toBe("node");
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.DATABASE_URL).toBe("pglite");
  });

  test("prefers Hyperdrive connection string on worker runtime", () => {
    const env = parseRuntimeEnv({
      RUNTIME: "worker",
      DATABASE_URL: "postgres://fallback/edaya",
      HYPERDRIVE: { connectionString: "postgres://hyperdrive/edaya" },
    });

    expect(env.RUNTIME).toBe("worker");
    expect(env.DATABASE_URL).toBe("postgres://hyperdrive/edaya");
  });

  test("rejects missing database URL", () => {
    expect(() => parseRuntimeEnv({ RUNTIME: "node" })).toThrow("DATABASE_URL is required");
  });
});
