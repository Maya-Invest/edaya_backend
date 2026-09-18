import { describe, expect, it } from "bun:test";
import indexRouter from "@/app-router";
import createApp from "@/http/create-app";
import { parseEnv } from "@/runtime";

const stagingEnv = parseEnv({
  RUNTIME: "in-memory",
  NODE_ENV: "production",
  PORT: 9999,
  LOG_LEVEL: "silent",
  DATABASE_URL: "pglite",
  API_ORIGIN: "https://api.school.edaya.test",
  IDENTITY_ISSUER: "https://identity.edaya.test",
  IDENTITY_DIRECTORY_URL: "https://identity.edaya.test",
  IDENTITY_DIRECTORY_SECRET: "test-directory-secret",
  CHILDREN_AI_RESOLVE_SECRET: "test-children-ai-resolve-secret",
  TRUSTED_ORIGINS: "https://app.edaya.test",
});

describe("staging CORS", () => {
  it("allows credentialed requests from the trusted SPA origin", async () => {
    const app = createApp();
    app.route("/", indexRouter);

    const response = await app.fetch(new Request("https://api.edaya.test/core/entities/schools/list", {
      method: "OPTIONS",
      headers: {
        "Origin": "https://app.edaya.test",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,x-academic-year-id",
      },
    }), stagingEnv);

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://app.edaya.test");
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("allows portal actor headers used by Flutter web clients", async () => {
    const app = createApp();
    app.route("/", indexRouter);

    const response = await app.fetch(new Request("https://api.edaya.test/core/entities/academic-years/list", {
      method: "OPTIONS",
      headers: {
        "Origin": "http://localhost:52733",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,x-academic-year-id,x-actor-kind",
      },
    }), stagingEnv);

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-headers")).toContain("X-Actor-Kind");
    expect(response.headers.get("access-control-allow-headers")).toContain("X-Academic-Year-Id");
  });
});
