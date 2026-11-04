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
  const client = new HttpSeedClient({ baseUrl: 'https://staging.api.edayaplus.com', fetch: async (input, init) => {
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
  const client = new HttpSeedClient({ baseUrl: 'https://staging.api.edayaplus.com', fetch: async () => {
    throw new Error('No request should be sent')
  } })
  await expect(new HttpAuthProvisioner(client).ensureUser({ email: 'fixture@example.test', password: 'unused', name: 'Fixture' })).rejects.toThrow('SEED_AUTH_SESSIONS_FILE')
})

test('local seeding accepts the current draft terms before starting OTP', async () => {
  delete process.env['SEED_AUTH_SESSIONS_FILE']
  const bodies: unknown[] = []
  const client = new HttpSeedClient({ baseUrl: 'http://127.0.0.1:9999', fetch: async (input, init) => {
    const url = new URL(String(input))
    if (url.pathname === '/auth/edaya/terms')
      return Response.json({ enforced: true, document: { version: 'draft-2026-10-25', locale: 'en', status: 'draft' } })
    if (url.pathname === '/auth/edaya/otp/start') {
      bodies.push(JSON.parse(String(init?.body)))
      return Response.json({ challenge: 'challenge-1' })
    }
    if (url.pathname === '/auth/edaya/testing/otp')
      return Response.json({ otp: '123456' })
    if (url.pathname === '/auth/edaya/otp/verify')
      return Response.json({ user: { id: 'seed-user' } })
    return new Response('unexpected', { status: 500 })
  } })
  expect(await new HttpAuthProvisioner(client).ensureUser({ email: 'owner@example.test', password: 'unused', name: 'Owner' })).toEqual({ subjectId: 'seed-user' })
  expect(bodies).toEqual([{ kind: 'email', value: 'owner@example.test', channel: 'email', termsAcceptance: { version: 'draft-2026-10-25', locale: 'en', accepted: true } }])
})

test('disposable rehearsal restores provisioned private sessions instead of invoking OTP capture', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'edaya-rehearsal-session-'))
  try {
    const file = join(directory, 'sessions.json')
    writeFileSync(file, JSON.stringify({ 'fixture@example.test': 'opaque-fixture-session' }), { mode: 0o600 })
    process.env['SEED_AUTH_SESSIONS_FILE'] = file
    const paths: string[] = []
    const client = new HttpSeedClient({ baseUrl: 'http://127.0.0.1:9999', fetch: async (input, init) => {
      paths.push(new URL(String(input)).pathname)
      expect(new Headers(init?.headers).get('cookie')).toBe('edaya_session=opaque-fixture-session')
      return Response.json({ user: { id: 'fixture-user' } })
    } })
    expect(await new HttpAuthProvisioner(client).ensureUser({ email: 'fixture@example.test', password: 'unused', name: 'Fixture' })).toEqual({ subjectId: 'fixture-user' })
    expect(paths).toEqual(['/auth/edaya/session'])
  }
  finally { rmSync(directory, { recursive: true }) }
})
