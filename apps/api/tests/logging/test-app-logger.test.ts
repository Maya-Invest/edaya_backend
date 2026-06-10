import { afterEach, describe, expect, it } from "bun:test";
import { Writable } from "node:stream";
import {
  createBetterAuthLogger,
  resetAppLoggersForTests,
  setAppLogDestinationForTests,
} from "@/lib/logging/app-logger";
import type { Environment } from "@/lib/bootstrap/env";

const baseEnv = {
  RUNTIME: "node",
  NODE_ENV: "development",
  PORT: 9999,
  DATABASE_URL: "pglite",
  BETTER_AUTH_SECRET: "super-secret-placeholder-key-for-local-testing",
  BETTER_AUTH_URL: "http://localhost:9999",
} as Environment;

describe("app logger", () => {
  afterEach(() => {
    resetAppLoggersForTests();
  });

  it("disables Better Auth logging when LOG_LEVEL is silent", () => {
    expect(createBetterAuthLogger({ ...baseEnv, LOG_LEVEL: "silent" })).toEqual({
      disabled: true,
    });
  });

  it("maps LOG_LEVEL to the Better Auth bridge level", () => {
    expect(createBetterAuthLogger({ ...baseEnv, LOG_LEVEL: "info" })).toMatchObject({
      level: "info",
      log: expect.any(Function),
    });
  });

  it("defaults Better Auth bridge level to warn when LOG_LEVEL is unset", () => {
    expect(createBetterAuthLogger(baseEnv)).toMatchObject({
      level: "warn",
    });
  });

  it("forwards log calls through the shared Pino logger", () => {
    const lines: string[] = [];
    setAppLogDestinationForTests(new Writable({
      write(chunk, _encoding, callback) {
        lines.push(chunk.toString());
        callback();
      },
    }));

    const authLogger = createBetterAuthLogger({ ...baseEnv, LOG_LEVEL: "warn" });
    authLogger.log?.("warn", "User not found", { email: "teacher@school.edu" });

    expect(lines.some(line => line.includes("User not found"))).toBe(true);
    expect(lines.some(line => line.includes("better-auth"))).toBe(true);
  });
});
