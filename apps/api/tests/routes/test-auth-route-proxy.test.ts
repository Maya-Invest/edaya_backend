import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import type { AppBindings } from "@/lib/types";

const authHandler = mock();

mock.module("@/routes/auth/auth.config", () => ({
  auth: {
    handler: authHandler,
  },
}));

const { default: indexRouter } = await import("@/routes/index.route");

describe("auth route proxy", () => {
  beforeEach(() => {
    authHandler.mockReset();
  });

  const setupTestApp = () => {
    const app = new Hono<AppBindings>();
    app.route("/", indexRouter);
    return app;
  };

  it("should proxy GET auth requests through the OpenAPI route", async () => {
    authHandler.mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const app = setupTestApp();
    const res = await app.request("/api/auth/session");

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
    expect(authHandler).toHaveBeenCalledWith(expect.any(Request));
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
    expect(authHandler).toHaveBeenCalledWith(expect.any(Request));
  });
});
