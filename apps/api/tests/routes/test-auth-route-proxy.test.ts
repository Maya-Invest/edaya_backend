import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import { parseEnv } from "@/lib/bootstrap/env";
import type { AppBindings } from "@/lib/http/types";
import indexRouter from "@/app-router";

const testEnv = parseEnv({
  RUNTIME: "node",
  NODE_ENV: "test",
  PORT: 9999,
  LOG_LEVEL: "silent",
  DATABASE_URL: "pglite",
  BETTER_AUTH_SECRET: "super-secret-placeholder-key-for-local-testing",
  BETTER_AUTH_URL: "http://localhost:9999",
});

describe("auth route proxy", () => {
  const authHandler = mock();

  beforeEach(() => {
    authHandler.mockReset();
  });

  const setupTestApp = () => {
    const app = new Hono<AppBindings>();
    app.use(async (c, next) => {
      c.env = testEnv;
      c.set("auth", {
        handler: authHandler,
        api: {
          getSession: mock(),
        },
      });
      await next();
    });
    app.route("/", indexRouter);
    return app;
  };

  it("should proxy GET auth requests through the OpenAPI route", async () => {
    authHandler.mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const app = setupTestApp();
    const res = await app.request("/api/auth/session");

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
    const proxiedRequest = authHandler.mock.calls[0]?.[0] as Request;
    expect(proxiedRequest.url).toBe("http://localhost:9999/api/auth/session");
  });

  it("should proxy POST auth requests through the OpenAPI route", async () => {
    authHandler.mockResolvedValueOnce(new Response("created", { status: 201 }));

    const app = setupTestApp();
    const res = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com", password: "secret" }),
    });

    expect(res.status).toBe(201);
    expect(await res.text()).toBe("created");
    const proxiedRequest = authHandler.mock.calls[0]?.[0] as Request;
    expect(proxiedRequest.url).toBe("http://localhost:9999/api/auth/sign-in/email");
  });
});
