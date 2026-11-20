import { describe, expect, it } from "bun:test";
import { platformBootstrapEmails } from "@/runtime/shared/env/derived";
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

  it("parses comma-separated PLATFORM_BOOTSTRAP_EMAILS", () => {
    expect(parseEnv({ DATABASE_URL: "pglite" }).PLATFORM_BOOTSTRAP_EMAILS).toBe("");
    expect(parseEnv({
      DATABASE_URL: "pglite",
      PLATFORM_BOOTSTRAP_EMAILS: "Op@EDaya.test, other@edaya.test",
    }).PLATFORM_BOOTSTRAP_EMAILS).toBe("Op@EDaya.test, other@edaya.test");
    expect(platformBootstrapEmails(parseEnv({
      DATABASE_URL: "pglite",
      PLATFORM_BOOTSTRAP_EMAILS: "Op@EDaya.test, other@edaya.test",
    }))).toEqual(["op@edaya.test", "other@edaya.test"]);
  });
});
