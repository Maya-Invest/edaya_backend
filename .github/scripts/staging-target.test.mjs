import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { parseJsonc, readConfig } from '../../apps/api/configuration/index.mjs';
import { assertHyperdrive, assertInitialIdentityHyperdrive, assertStagingConfiguration, releaseOptions, staging, loadStagingTarget } from './staging-target.mjs';

const config = () => ({
  RELEASE_TARGET: 'staging', RESET_DATA: 'false', CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), STAGING_ZONE_NAME: 'edayaplus.com',
  STAGING_DATABASE_URL: 'postgres://school:test@stage.example/main?sslmode=require',
  STAGING_AUTH_DATABASE_URL: 'postgres://auth_owner:test@stage.example/accounts?sslmode=require',
});
const drive = (target, identity = false) => ({ origin: { host: target.databaseHost, database: identity ? target.identityDatabase : target.schoolDatabase, user: identity ? target.identityRole : target.schoolRole }, caching: { disabled: true } });

test('preserves data unless reset is explicit', () => {
  expect(releaseOptions(config()).reset).toBe(false);
  expect(releaseOptions({ ...config(), RESET_DATA: 'true' }).reset).toBe(true);
});
test('rejects non-staging target, missing configuration, pooled/insecure/shared databases and malformed secrets', () => {
  for (const patch of [
    { RELEASE_TARGET: 'production' }, { RESET_DATA: undefined }, { RESET_DATA: '1' }, { CLOUDFLARE_ACCOUNT_ID: '' }, { STAGING_ZONE_NAME: '' }, { STAGING_ZONE_NAME: 'other.example' },
    { STAGING_AUTH_DATABASE_URL: config().STAGING_DATABASE_URL },
    ...[
      config().STAGING_AUTH_DATABASE_URL.replace('auth_owner:', 'school:'),
      config().STAGING_AUTH_DATABASE_URL.replace('stage.example', 'stage-pooler.example'),
      config().STAGING_AUTH_DATABASE_URL.replace('stage.example', 'other.example'),
      config().STAGING_AUTH_DATABASE_URL.replace('require', 'disable'),
      'postgres://private-password@%invalid',
    ].map(STAGING_AUTH_DATABASE_URL => ({ STAGING_AUTH_DATABASE_URL })),
  ]) expect(() => releaseOptions({ ...config(), ...patch })).toThrow();
  try { releaseOptions({ ...config(), STAGING_AUTH_DATABASE_URL: 'postgres://private-password@%invalid' }); }
  catch (error) { expect(error.message).not.toContain('private-password'); }
});
test('rotating CI credentials changes the expected target without editing tracked configuration', () => {
  const original = releaseOptions(config()).target;
  const env = { ...config(), CLOUDFLARE_ACCOUNT_ID: 'b'.repeat(32), STAGING_DATABASE_URL: 'postgres://new_school:new-password@rotated.example/new_school?sslmode=verify-full', STAGING_AUTH_DATABASE_URL: 'postgres://new_auth:new-password@rotated.example/new_auth?sslmode=verify-full' };
  const { target } = releaseOptions(env);
  expect(target).toMatchObject({ account: env.CLOUDFLARE_ACCOUNT_ID, databaseHost: 'rotated.example', schoolDatabase: 'new_school', identityDatabase: 'new_auth', identityRole: 'new_auth' });
  expect(JSON.stringify(target)).not.toContain('new-password');
  expect(() => assertHyperdrive(drive(target), target.schoolDatabase, target.schoolRole, target)).not.toThrow();
  expect(() => assertHyperdrive(drive(original), target.schoolDatabase, target.schoolRole, target)).toThrow();
});
test('live Hyperdrive host, database, role and disabled caching must match the CI secrets', () => {
  const { target } = releaseOptions(config());
  const value = drive(target);
  for (const patch of [{ origin: { ...value.origin, host: 'other.example' } }, { origin: { ...value.origin, database: 'other' } }, { origin: { ...value.origin, user: 'other' } }, { caching: { disabled: false } }])
    expect(() => assertHyperdrive({ ...value, ...patch }, target.schoolDatabase, target.schoolRole, target)).toThrow();
  for (const identity of [false, true]) expect(() => assertInitialIdentityHyperdrive(drive(target, identity), target.schoolRole, target)).not.toThrow();
  expect(() => assertInitialIdentityHyperdrive({ ...drive(target, true), origin: { ...drive(target, true).origin, user: target.schoolRole } }, target.schoolRole, target)).toThrow();
});
test('resources come from existing Wrangler/application configuration without live credentials', () => {
  const worker = parseJsonc(readFileSync(new URL('../../apps/api/wrangler.jsonc', import.meta.url), 'utf8')).env.staging;
  const app = readConfig('staging');
  const target = loadStagingTarget(worker, app);
  expect(target.schoolHyperdrive).toBe(worker.hyperdrive.find(binding => binding.binding === 'HYPERDRIVE').id);
  expect(target.urls.api).toBe(app.API_ORIGIN);
  expect(target).not.toHaveProperty('databaseHost');
  expect(target).not.toHaveProperty('account');
  expect(() => loadStagingTarget({ ...worker, hyperdrive: [] }, app)).toThrow('HYPERDRIVE');
  expect(() => loadStagingTarget(worker, app, { webapp: { name: 'web', routes: [{ custom_domain: true, pattern: 'wrong.example' }] } })).toThrow('domain differs');
});
test('application configuration retains bucket/origin consistency and disabled phone auth', () => {
  const config = { API_ORIGIN: staging.urls.api, WEBAPP_ORIGIN: staging.urls.webapp, R2_BUCKET_NAME: staging.bucket, PHONE_AUTH_MODE: 'disabled' };
  expect(() => assertStagingConfiguration(config)).not.toThrow();
  for (const patch of [{ R2_BUCKET_NAME: 'other' }, { API_ORIGIN: 'https://other.example' }, { PHONE_AUTH_MODE: 'sms_only' }])
    expect(() => assertStagingConfiguration({ ...config, ...patch })).toThrow();
});
