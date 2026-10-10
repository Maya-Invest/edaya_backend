import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { releaseState, assertPausedMaintenance } from './staging-runtime.mjs';
import { stagingDatabaseTarget } from '../../tooling/repo/db/lib/staging-validation';

test('phase receipts reject skipped phases and changed candidates, configuration, reset mode or attempts', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'staging-phases-'));
  try {
    const identity = { candidate: 'a', target: 'staging', reset: false, attempt: '1' };
    const file = resolve(root, 'state.json');
    const state = releaseState(file, identity);
    expect(() => state.requirePhase('prepared')).toThrow('preparation is required');
    state.setPhase('prepared');
    expect(() => state.requirePhase('prepared')).not.toThrow();
    expect(() => state.requirePhase('migrated')).toThrow();
    for (const patch of [{ candidate: 'b' }, { target: 'other' }, { reset: true }, { attempt: '2' }])
      expect(() => releaseState(file, { ...identity, ...patch }).requirePhase('prepared')).toThrow('another candidate');
    state.setPhase('migrating');
    expect(() => state.requirePhase('prepared')).toThrow();
    state.setPhase('migrated');
    expect(() => state.requirePhase('migrated')).not.toThrow();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('migration guard reads all pause controls, queue pause and actual API maintenance response', async () => {
  const controls = ['PAUSE_API', 'PAUSE_SCHEDULER', 'PAUSE_JOBS'].map(name => ({ name, type: 'plain_text', text: 'true' }));
  let httpChecks = 0;
  const verify = (bindings, paused = true, httpOk = true) => assertPausedMaintenance(
    async () => ({ bindings }), async () => ({ settings: { delivery_paused: paused } }),
    async (_url, expected) => { httpChecks++; expect(expected).toBe(503); if (!httpOk) throw new Error('API is not paused'); },
  );
  for (let index = 0; index < controls.length; index++) {
    await expect(verify(controls.filter((_, i) => i !== index))).rejects.toThrow();
    await expect(verify(controls.map((value, i) => i === index ? { ...value, text: 'false' } : value))).rejects.toThrow();
  }
  await expect(verify([...controls, controls[0]])).rejects.toThrow();
  await expect(verify(controls, false)).rejects.toThrow();
  expect(httpChecks).toBe(0);
  await expect(verify(controls, true, false)).rejects.toThrow('API is not paused');
  await verify(controls);
});

test('database commands validate explicit configured names and roles, keeping TLS and isolation checks', () => {
  const env = { RELEASE_TARGET: 'staging', RESET_DATA: 'false', STAGING_DATABASE_HOST: 'configured.example', STAGING_SCHOOL_DATABASE: 'main', STAGING_IDENTITY_DATABASE: 'accounts', STAGING_IDENTITY_ROLE: 'account_owner', STAGING_DATABASE_URL: 'postgres://school:private@configured.example/main?sslmode=require', STAGING_AUTH_DATABASE_URL: 'postgres://account_owner:private@configured.example/accounts?sslmode=require' };
  expect(stagingDatabaseTarget('school', env).pathname).toBe('/main');
  expect(stagingDatabaseTarget('identity', env).pathname).toBe('/accounts');
  expect(stagingDatabaseTarget('identity', { ...env, VALIDATE_ONLY: 'true' }).pathname).toBe('/accounts');
  for (const patch of [{ STAGING_IDENTITY_DATABASE: 'main' }, { STAGING_DATABASE_HOST: '' }, { STAGING_IDENTITY_ROLE: 'school' }, { STAGING_AUTH_DATABASE_URL: env.STAGING_AUTH_DATABASE_URL.replace('require', 'disable') }])
    expect(() => stagingDatabaseTarget('identity', { ...env, ...patch })).toThrow();
});
