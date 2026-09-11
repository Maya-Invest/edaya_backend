import { describe, expect, it } from "bun:test";
import { parseEnv } from "@/runtime/shared/env/schema";

describe("release-candidate runtime invariants", () => {
  it("parses boolean strings without treating false as truthy", () => {
    for (const value of ["false", "0", false]) {
      expect(parseEnv({ DATABASE_URL: "pglite", ALLOW_PUBLIC_SCHOOL_REGISTRATION: value }).ALLOW_PUBLIC_SCHOOL_REGISTRATION).toBe(false);
    }
    for (const value of ["true", "1", true]) {
      expect(parseEnv({ DATABASE_URL: "pglite", ALLOW_PUBLIC_SCHOOL_REGISTRATION: value }).ALLOW_PUBLIC_SCHOOL_REGISTRATION).toBe(true);
    }
    expect(() => parseEnv({ DATABASE_URL: "pglite", ALLOW_PUBLIC_SCHOOL_REGISTRATION: "perhaps" })).toThrow();
  });

  it("keeps cross-request grants caching disabled", () => {
    expect(() => parseEnv({ DATABASE_URL: "pglite", GRANTS_CACHE_TTL_MS: 300000 })).toThrow("GRANTS_CACHE_TTL_MS");
  });
});
