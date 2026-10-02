import { describe, expect, test } from "bun:test";
import { parseEnv, resolveAllowlistedApiOrigin } from "../src/env";

const secret = "test-secret-placeholder-key-32chars";
const directory = "test-directory-secret";
function parse(source: Record<string, unknown>) {
  return parseEnv({
    RUNTIME: "test",
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    BETTER_AUTH_SECRET: secret,
    BETTER_AUTH_URL: "http://localhost:9900",
    IDENTITY_DIRECTORY_SECRET: directory,
    ...source,
  }, "test");
}
describe("FIRST_PARTY_API_ORIGINS", () => {
  test("accepts one origin", () => {
    const env = parse({ FIRST_PARTY_API_ORIGINS: "http://localhost:9999" });
    expect(env.firstPartyApiOrigins).toEqual(["http://localhost:9999"]);
  });
  test("accepts multiple origins and trims configuration whitespace", () => {
    const env = parse({
      FIRST_PARTY_API_ORIGINS: " http://localhost:9999 , http://localhost:10000 ",
    });
    expect(env.firstPartyApiOrigins).toEqual([
      "http://localhost:9999",
      "http://localhost:10000",
    ]);
  });
  test("rejects a missing variable", () => {
    expect(() => parse({})).toThrow(/FIRST_PARTY_API_ORIGINS/);
  });
  test("rejects legacy SCHOOL_API_ORIGIN", () => {
    expect(() => parse({
      FIRST_PARTY_API_ORIGINS: "http://localhost:9999",
      SCHOOL_API_ORIGIN: "http://localhost:9999",
    })).toThrow(/SCHOOL_API_ORIGIN was removed/);
  });
  test("rejects legacy SCHOOL_API_ORIGIN alone", () => {
    expect(() => parse({
      SCHOOL_API_ORIGIN: "http://localhost:9999",
    })).toThrow(/SCHOOL_API_ORIGIN was removed|FIRST_PARTY_API_ORIGINS/);
  });
  test("rejects an empty list", () => {
    expect(() => parse({ FIRST_PARTY_API_ORIGINS: " , " })).toThrow(/At least one first-party API origin/);
  });
  test("rejects duplicate origins", () => {
    expect(() => parse({
      FIRST_PARTY_API_ORIGINS: "http://localhost:9999,http://localhost:9999",
    })).toThrow(/duplicates/);
  });
  test("rejects an invalid URL", () => {
    expect(() => parse({ FIRST_PARTY_API_ORIGINS: "not-a-url" })).toThrow(/Invalid first-party API origin/);
  });
  test("rejects a non-HTTP scheme", () => {
    expect(() => parse({ FIRST_PARTY_API_ORIGINS: "ftp://localhost:9999" })).toThrow(/Invalid first-party API origin/);
  });
  test("rejects wildcards", () => {
    expect(() => parse({ FIRST_PARTY_API_ORIGINS: "https://*.edayaplus.com" })).toThrow(/Invalid first-party API origin/);
  });
  test("rejects a path, slash, query, fragment, and credentials", () => {
    expect(() => parse({ FIRST_PARTY_API_ORIGINS: "http://localhost:9999/" })).toThrow(/Invalid first-party API origin/);
    expect(() => parse({ FIRST_PARTY_API_ORIGINS: "http://localhost:9999/v1" })).toThrow(/Invalid first-party API origin/);
    expect(() => parse({ FIRST_PARTY_API_ORIGINS: "http://localhost:9999?x=1" })).toThrow(/Invalid first-party API origin/);
    expect(() => parse({ FIRST_PARTY_API_ORIGINS: "http://localhost:9999#x" })).toThrow(/Invalid first-party API origin/);
    expect(() => parse({ FIRST_PARTY_API_ORIGINS: "http://user:pass@localhost:9999" })).toThrow(/Invalid first-party API origin/);
  });
  test("rejects noncanonical host casing and default ports", () => {
    expect(() => parse({ FIRST_PARTY_API_ORIGINS: "http://Localhost:9999" })).toThrow(/Invalid first-party API origin/);
    expect(() => parse({ FIRST_PARTY_API_ORIGINS: "https://api.example.com:443" })).toThrow(/Invalid first-party API origin/);
  });
  test("rejects HTTP origins in production", () => {
    expect(() => parse({
      NODE_ENV: "production",
      IDENTITY_DIRECTORY_SECRET: "production-directory-secret",
      FIRST_PARTY_API_ORIGINS: "http://localhost:9999",
    })).toThrow(/must use HTTPS/);
  });
});
test("preserves Cloudflare email and KV bindings", () => {
  const EMAIL = { send: async () => { } };
  const AUTH_KV = { get: async () => null };
  const env = parse({ FIRST_PARTY_API_ORIGINS: "http://localhost:9999", EMAIL, AUTH_KV });
  expect(env.EMAIL).toBe(EMAIL);
  expect(env.AUTH_KV).toBe(AUTH_KV);
});
describe("resolveAllowlistedApiOrigin", () => {
  const allowlist = ["http://localhost:9999", "http://localhost:8787"] as const;
  test("returns an exact allowlisted origin", () => {
    expect(resolveAllowlistedApiOrigin("http://localhost:9999", allowlist)).toBe("http://localhost:9999");
  });
  test("maps Android emulator and loopback hosts to the allowlisted localhost origin", () => {
    expect(resolveAllowlistedApiOrigin("http://10.0.2.2:9999", allowlist)).toBe("http://localhost:9999");
    expect(resolveAllowlistedApiOrigin("http://127.0.0.1:9999", allowlist)).toBe("http://localhost:9999");
    expect(resolveAllowlistedApiOrigin("http://10.0.2.2:8787", allowlist)).toBe("http://localhost:8787");
  });
  test("rejects a loopback origin whose port is not allowlisted", () => {
    expect(resolveAllowlistedApiOrigin("http://10.0.2.2:10000", allowlist)).toBeUndefined();
  });
  test("rejects a non-loopback origin that is not allowlisted", () => {
    expect(resolveAllowlistedApiOrigin("https://staging.school.api.edayaplus.com", allowlist)).toBeUndefined();
  });
});
