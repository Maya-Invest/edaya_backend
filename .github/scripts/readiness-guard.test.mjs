import { expect, test } from "bun:test";
import { assertReadinessEnvironment } from "./readiness-guard.mjs";
const env = { VALIDATE_ONLY: "true", RESET_DATA: "false", REPOSITORY_READINESS: "true" };
test("readiness rejects live credentials and inherited fixture targets", () => {
  expect(() => assertReadinessEnvironment(env)).not.toThrow();
  for (const key of ["CLOUDFLARE_API_TOKEN", "DATABASE_URL", "AUTH_DATABASE_URL", "STAGING_DATABASE_URL", "STAGING_AUTH_DATABASE_URL", "STAGING_API_SECRETS", "SEED_API_URL", "PGHOST", "EDAYA_TEST_API_URL", "ANDROID_SIGNING_BUNDLE"])
    expect(() => assertReadinessEnvironment({ ...env, [key]: "private" })).toThrow(key);
  for (const patch of [{ VALIDATE_ONLY: "false" }, { RESET_DATA: "true" }, { REPOSITORY_READINESS: undefined }])
    expect(() => assertReadinessEnvironment({ ...env, ...patch })).toThrow();
});
