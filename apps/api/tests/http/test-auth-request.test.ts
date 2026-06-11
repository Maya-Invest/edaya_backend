import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { parseEnv } from "@/lib/runtime/env";
import { toBetterAuthHandlerRequest } from "@/lib/http/auth-request";
import type { AppBindings } from "@/lib/http/types";

const env = parseEnv({
  RUNTIME: "node",
  NODE_ENV: "test",
  PORT: 9999,
  LOG_LEVEL: "silent",
  DATABASE_URL: "pglite",
  BETTER_AUTH_SECRET: "test-secret",
  BETTER_AUTH_URL: "http://localhost:9999",
});

describe("toBetterAuthHandlerRequest", () => {
  it("rewrites the request URL to BETTER_AUTH_URL", async () => {
    const app = new Hono<AppBindings>();
    let capturedUrl = "";

    app.use(async (c, next) => {
      c.env = env;
      await next();
    });

    app.post("/auth/sign-in/email", async (c) => {
      capturedUrl = toBetterAuthHandlerRequest(c).url;
      return c.text("ok");
    });

    await app.request("http://localhost/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", password: "secret" }),
    });

    expect(capturedUrl).toBe("http://localhost:9999/auth/sign-in/email");
  });

  it("preserves query strings", async () => {
    const app = new Hono<AppBindings>();
    let capturedUrl = "";

    app.use(async (c, next) => {
      c.env = env;
      await next();
    });

    app.get("/auth/get-session", async (c) => {
      capturedUrl = toBetterAuthHandlerRequest(c).url;
      return c.text("ok");
    });

    await app.request("http://127.0.0.1/auth/get-session?foo=bar", {
      method: "GET",
    });

    expect(capturedUrl).toBe("http://localhost:9999/auth/get-session?foo=bar");
  });
});
