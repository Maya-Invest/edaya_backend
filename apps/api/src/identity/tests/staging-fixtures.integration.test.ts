import { describe, expect, test } from "bun:test";
import { createAccountRepository } from "@edaya/adaptor-account";
import { createAuthDatabase } from "../database";
import { parseEnv } from "../env";
import { assertStagingFixtureTarget, provisionFixtureAccounts } from "../staging-fixtures";

const env = parseEnv({ RUNTIME: "test", NODE_ENV: "test", LOG_LEVEL: "silent", AUTH_DATABASE_URL: "pglite", BETTER_AUTH_SECRET: "test-only-identity-secret-at-least-32-characters", BETTER_AUTH_URL: "http://localhost:9999", FIRST_PARTY_API_ORIGINS: "http://localhost:9999", REQUIRE_EMAIL_VERIFICATION: true, EMAIL_TRANSPORT: "log" }, "test");
describe("administrative staging fixtures", () => {
  test("rejects production, shared databases, pooled and mismatched targets", () => {
    const target = "postgres://edaya_identity:password@ep-stage.neon.tech/edaya_identity";
    expect(() => assertStagingFixtureTarget(target, "ep-stage.neon.tech", "edaya_identity", "edaya_identity")).not.toThrow();
    for (const url of [target.replace("ep-stage", "ep-prod"), target.replace("/edaya_identity", "/neondb"), target.replace("ep-stage", "ep-stage-pooler")]) {
      expect(() => assertStagingFixtureTarget(url, "ep-stage.neon.tech", "edaya_identity", "edaya_identity")).toThrow();
    }
  });
  test("creates durable fixture Accounts without passwords and safely repeats", async () => {
    const handle = await createAuthDatabase(env);
    const accounts = [{ email: "fixture@example.test", password: "FixturePassword1!", name: "Fixture" }];
    try {
      expect(await provisionFixtureAccounts(handle.db, env, accounts)).toBe(1);
      expect(await provisionFixtureAccounts(handle.db, env, accounts)).toBe(1);
      const { repository } = createAccountRepository(handle.db);
      expect((await repository.find("email", accounts[0]!.email))?.identifiers).toHaveLength(1);
    }
    finally {
      await handle.dispose();
    }
  }, 120000);
});
