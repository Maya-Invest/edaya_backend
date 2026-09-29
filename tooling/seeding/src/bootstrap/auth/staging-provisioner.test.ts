/* eslint-disable dot-notation -- Process environment uses an index signature. */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'bun:test'
import { HttpSeedClient } from '../../transport/http/client'
import { HttpAuthProvisioner } from './http-provisioner'

const original = process.env['SEED_AUTH_SESSIONS_FILE']
const folder = mkdtempSync(join(tmpdir(), 'edaya-seed-auth-'))
afterEach(() => {
  if (original === undefined)
    delete process.env['SEED_AUTH_SESSIONS_FILE']
  else process.env['SEED_AUTH_SESSIONS_FILE'] = original
})
test('remote seeding restores only explicitly supplied Account sessions', async () => {
  const file = join(folder, 'sessions.json')
  writeFileSync(file, JSON.stringify({ 'fixture@example.test': 'opaque-fixture-session' }), { mode: 0o600 })
  process.env['SEED_AUTH_SESSIONS_FILE'] = file
  const paths: string[] = []
  const client = new HttpSeedClient({ baseUrl: 'https://staging.school.api.edayaplus.com', authUrl: 'https://staging.identity.api.edayaplus.com', fetch: async (input, init) => {
    paths.push(new URL(String(input)).pathname)
    expect(new Headers(init?.headers).get('cookie')).toContain('__Host-edaya_session=opaque-fixture-session')
    return Response.json({ user: { id: 'fixture-user' } })
  } })
  expect(await new HttpAuthProvisioner(client).ensureUser({ email: 'fixture@example.test', password: 'unused', name: 'Fixture' })).toEqual({ subjectId: 'fixture-user' })
  expect(paths).toEqual(['/auth/edaya/session'])
  rmSync(folder, { recursive: true })
})
test('remote seeding cannot fall back to password or an OTP-peek endpoint', async () => {
  delete process.env['SEED_AUTH_SESSIONS_FILE']
  const client = new HttpSeedClient({ baseUrl: 'https://staging.school.api.edayaplus.com', fetch: async () => {
    throw new Error('No request should be sent')
  } })
  await expect(new HttpAuthProvisioner(client).ensureUser({ email: 'fixture@example.test', password: 'unused', name: 'Fixture' })).rejects.toThrow('SEED_AUTH_SESSIONS_FILE')
})
