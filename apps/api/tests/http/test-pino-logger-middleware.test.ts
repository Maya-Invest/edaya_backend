import { describe, expect, it } from "bun:test";
import { parseEnv } from "@/runtime";
import { pinoLogger } from "@/http/middleware/logger";

const baseEnv = parseEnv({
  RUNTIME: "in-memory",
  NODE_ENV: "test",
  PORT: 9999,
  LOG_LEVEL: "silent",
  DATABASE_URL: "postgres://admin:admin@localhost:5432/test_db",
});

describe("pinoLogger middleware", () => {
  it("returns middleware that completes the request chain", async () => {
    const middleware = pinoLogger();
    let nextCalled = false;

    await middleware({
      env: baseEnv,
      req: {
        raw: { headers: new Headers() },
        header: () => undefined,
      },
      res: { status: 200 },
      set: () => undefined,
      get: () => undefined,
    } as never, async () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });
});
