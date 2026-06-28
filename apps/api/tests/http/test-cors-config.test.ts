import { describe, expect, it } from "bun:test";
import { resolveCorsOrigin, trustedOriginsFromEnv } from "@/http/cors";
import { parseEnv } from "@/runtime";

describe("CORS configuration", () => {
  it("parses comma-separated TRUSTED_ORIGINS", () => {
    expect(trustedOriginsFromEnv("https://app.edaya.test, https://admin.edaya.test")).toEqual([
      "https://app.edaya.test",
      "https://admin.edaya.test",
    ]);
  });

  it("falls back to localhost defaults when TRUSTED_ORIGINS is empty", () => {
    expect(trustedOriginsFromEnv("")).toEqual([
      "http://localhost:5173",
      "http://localhost:4173",
    ]);
  });

  it("reflects a trusted origin and rejects unknown origins", () => {
    const env = parseEnv({
      RUNTIME: "local",
      NODE_ENV: "production",
      PORT: 9999,
      LOG_LEVEL: "silent",
      DATABASE_URL: "pglite",
      BETTER_AUTH_SECRET: "super-secret-placeholder-key-for-local-testing",
      BETTER_AUTH_URL: "https://api.edaya.test",
      TRUSTED_ORIGINS: "https://app.edaya.test",
    });

    expect(resolveCorsOrigin("https://app.edaya.test", env)).toBe("https://app.edaya.test");
    expect(resolveCorsOrigin("https://evil.example", env)).toBe("https://app.edaya.test");
    expect(resolveCorsOrigin(undefined, env)).toBe("https://app.edaya.test");
  });

  it("allows any localhost origin in development for mobile and Flutter web dev servers", () => {
    const env = parseEnv({
      RUNTIME: "local",
      NODE_ENV: "development",
      PORT: 9999,
      LOG_LEVEL: "silent",
      DATABASE_URL: "pglite",
      BETTER_AUTH_SECRET: "super-secret-placeholder-key-for-local-testing",
      BETTER_AUTH_URL: "http://localhost:9999",
      TRUSTED_ORIGINS: "http://localhost:5173",
    });

    expect(resolveCorsOrigin("http://localhost:5173", env)).toBe("http://localhost:5173");
    expect(resolveCorsOrigin("http://localhost:8080", env)).toBe("http://localhost:8080");
    expect(resolveCorsOrigin("http://127.0.0.1:54321", env)).toBe("http://127.0.0.1:54321");
    expect(resolveCorsOrigin("https://evil.example", env)).toBe("http://localhost:5173");
  });
});
