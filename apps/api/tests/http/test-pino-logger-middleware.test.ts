import { describe, expect, it } from "bun:test";
import { parseEnv } from "@/runtime";
import { pinoLogger } from "@/http/middleware/logger";
import { resetAppLoggersForTests, setAppLogDestinationForTests } from "@/runtime/shared/adapters/pino-logger";
import { Hono } from "hono";
import type { AppBindings } from "@/http/types";

const baseEnv = parseEnv({
  RUNTIME: "in-memory",
  NODE_ENV: "test",
  PORT: 9999,
  LOG_LEVEL: "silent",
  DATABASE_URL: "postgres://admin:admin@localhost:5432/test_db",
});

describe("pinoLogger middleware", () => {
  it("omits temporary storage capabilities, download locations and request credentials", async () => {
    const logs: string[] = [];
    setAppLogDestinationForTests({ write: value => void logs.push(value) });
    try {
      const app = new Hono<AppBindings>();
      app.use(async (c, next) => {
        c.env = { ...baseEnv, LOG_LEVEL: "info" };
        await next();
      });
      app.use(pinoLogger());
      app.get("/core/files/memory/:key", c => c.redirect("https://storage.example/file?signature=download-secret"));
      app.post("/public/invitations/:token/accept", c => c.json({ accepted: true }));
      const response = await app.request("/core/files/memory/upload-capability-secret", { headers: { authorization: "Bearer auth-secret" } });
      expect(response.status).toBe(302);
      expect((await app.request("/public/invitations/invitation-credential-secret/accept", { method: "POST" })).status).toBe(200);
      const output = logs.join("\n");
      expect(output).toContain("[redacted]");
      expect(output).not.toContain("upload-capability-secret");
      expect(output).not.toContain("download-secret");
      expect(output).not.toContain("auth-secret");
      expect(output).not.toContain("invitation-credential-secret");
    }
    finally {
      resetAppLoggersForTests();
    }
  });
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
