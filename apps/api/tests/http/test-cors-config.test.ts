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
      RUNTIME: "node",
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
});
