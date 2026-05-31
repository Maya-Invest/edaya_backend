import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { auth } from "@/routes/auth/auth.config";
import indexRouter from "@/routes/index.route";
import type { AppBindings } from "@/lib/types";

vi.mock("@/routes/auth/auth.config", () => ({
  auth: {
    handler: vi.fn(),
  },
}));

describe("auth route proxy", () => {
  const setupTestApp = () => {
    const app = new Hono<AppBindings>();
    app.route("/", indexRouter);
    return app;
  };

  it("should proxy GET auth requests through the OpenAPI route", async () => {
    vi.mocked(auth.handler).mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const app = setupTestApp();
    const res = await app.request("/api/auth/session");

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
    expect(auth.handler).toHaveBeenCalledWith(expect.any(Request));
  });

  it("should proxy POST auth requests through the OpenAPI route", async () => {
    vi.mocked(auth.handler).mockResolvedValueOnce(new Response("created", { status: 201 }));

    const app = setupTestApp();
    const res = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com", password: "secret" }),
    });

    expect(res.status).toBe(201);
    expect(await res.text()).toBe("created");
    expect(auth.handler).toHaveBeenCalledWith(expect.any(Request));
  });
});
