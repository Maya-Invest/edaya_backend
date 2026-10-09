import { describe, expect, test } from "bun:test";
import { assertHyperdrive, assertInitialIdentityHyperdrive, assertStagingConfiguration, releaseOptions, staging } from "./staging-target.mjs";

const config = () => ({
  RELEASE_TARGET: "staging", RESET_DATA: "false", CLOUDFLARE_ACCOUNT_ID: staging.account,
  STAGING_DATABASE_URL: `postgres://school:test@${staging.databaseHost}/neondb?sslmode=require`,
  STAGING_AUTH_DATABASE_URL: `postgres://edaya_identity:test@${staging.databaseHost}/edaya_identity?sslmode=require`,
});
describe("coordinated staging release guards", () => {
  test("preserves data unless reset is explicit", () => {
    expect(releaseOptions(config()).reset).toBe(false);
    expect(releaseOptions({ ...config(), RESET_DATA: "true" }).reset).toBe(true);
  });
  test("rejects production, missing switches, and other accounts", () => {
    for (const patch of [{ RELEASE_TARGET: "production" }, { RESET_DATA: "1" }, { RESET_DATA: undefined }, { CLOUDFLARE_ACCOUNT_ID: "production" }])
      expect(() => releaseOptions({ ...config(), ...patch })).toThrow();
  });
  test("rejects shared identity database, wrong role, pooled endpoint, and insecure TLS", () => {
    for (const value of [config().STAGING_DATABASE_URL,
      config().STAGING_AUTH_DATABASE_URL.replace("edaya_identity:test", "neondb_owner:test"),
      config().STAGING_AUTH_DATABASE_URL.replace(".c-12", "-pooler.c-12"),
      config().STAGING_AUTH_DATABASE_URL.replace("require", "disable"),
      config().STAGING_AUTH_DATABASE_URL.replace("ep-holy-mouse-awj7ghpf", "production")])
      expect(() => releaseOptions({ ...config(), STAGING_AUTH_DATABASE_URL: value })).toThrow();
  });
  test("rejects cached or mismatched Hyperdrive configuration", () => {
    const drive = { origin: { host: staging.databaseHost, database: "neondb" }, caching: { disabled: true } };
    expect(() => assertHyperdrive(drive, "neondb")).not.toThrow();
    expect(() => assertHyperdrive(drive, "edaya_identity")).toThrow();
    expect(() => assertHyperdrive({ ...drive, caching: { disabled: false } }, "neondb")).toThrow();
  });
});

test("initial identity binding accepts only the final identity role or recorded legacy school role", () => {
  const drive = (database, user, host = staging.databaseHost, disabled = true) => ({ origin: { database, user, host }, caching: { disabled } });
  for (const value of [drive("neondb", "school"), drive("edaya_identity", "edaya_identity")])
    expect(() => assertInitialIdentityHyperdrive(value, "school")).not.toThrow();
  for (const value of [drive("neondb", "other"), drive("other", "school"), drive("edaya_identity", "school"), drive("neondb", "school", "other"), drive("neondb", "school", staging.databaseHost, false)])
    expect(() => assertInitialIdentityHyperdrive(value, "school")).toThrow();
});
test("staging settings must match resource targets and email-only authentication", () => {
  const config = { API_ORIGIN: staging.urls.api, WEBAPP_ORIGIN: staging.urls.webapp, R2_BUCKET_NAME: staging.bucket, PHONE_AUTH_MODE: "disabled" };
  expect(() => assertStagingConfiguration(config)).not.toThrow();
  for (const patch of [{ R2_BUCKET_NAME: "edaya-files-dev" }, { API_ORIGIN: "https://other.example" }, { PHONE_AUTH_MODE: "sms_only" }])
    expect(() => assertStagingConfiguration({ ...config, ...patch })).toThrow();
});
