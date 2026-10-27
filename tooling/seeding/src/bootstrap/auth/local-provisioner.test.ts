/* eslint-disable dot-notation -- Process environment uses an index signature. */
import { afterEach, expect, test } from 'bun:test'
import { HttpSeedClient } from '../../transport/http/client'
import { signInSeedAccount } from './http-provisioner'

const originalSessions = process.env['SEED_AUTH_SESSIONS_FILE']
const originalMailbox = process.env['EDAYA_TEST_OTP_FILE']
afterEach(() => {
  for (const [key, value] of [['SEED_AUTH_SESSIONS_FILE', originalSessions], ['EDAYA_TEST_OTP_FILE', originalMailbox]]) {
    if (value === undefined)
      delete process.env[key!]
    else process.env[key!] = value
  }
})

function fixture(terms: unknown, termsStatus = 200) {
  delete process.env['SEED_AUTH_SESSIONS_FILE']
  delete process.env['EDAYA_TEST_OTP_FILE']
  const calls: Array<{ path: string, body: Record<string, unknown> }> = []
  const client = new HttpSeedClient({ baseUrl: 'http://localhost:9999', fetch: async (input, init) => {
    const url = new URL(String(input))
    const path = `${url.pathname}${url.search}`
    calls.push({ path, body: JSON.parse(String(init?.body ?? '{}')) })
    switch (url.pathname) {
      case '/auth/edaya/terms': return Response.json(terms, { status: termsStatus })
      case '/auth/edaya/otp/start': return Response.json({ challenge: 'challenge' })
      case '/auth/edaya/testing/otp': return Response.json({ otp: '123456' })
      case '/auth/edaya/otp/verify': return Response.json({ user: { id: 'fixture-user' } })
      default: throw new Error(`Unexpected request: ${path}`)
    }
  } })
  return { client, calls }
}

test('local fixture login acknowledges the current preview version before OTP delivery', async () => {
  const { client, calls } = fixture({ enforced: true, document: { version: 'preview-v2', locale: 'en', status: 'draft' } })
  expect(await signInSeedAccount(client, 'fixture@example.test')).toEqual({ subjectId: 'fixture-user' })
  expect(calls.map(call => call.path)).toEqual(['/auth/edaya/terms?locale=en', '/auth/edaya/otp/start', '/auth/edaya/testing/otp', '/auth/edaya/otp/verify'])
  expect(calls[1]?.body['termsAcceptance']).toEqual({ version: 'preview-v2', locale: 'en', accepted: true })
})

test('terms-disabled fixture login sends no acceptance', async () => {
  const { client, calls } = fixture({ enforced: false, document: null })
  await signInSeedAccount(client, 'fixture@example.test')
  expect(calls[1]?.body).not.toHaveProperty('termsAcceptance')
})

test('published or unavailable terms block fixture OTP before delivery', async () => {
  for (const document of [{ version: 'v1', locale: 'en', status: 'published' }, null]) {
    const { client, calls } = fixture({ enforced: true, document })
    await expect(signInSeedAccount(client, 'fixture@example.test')).rejects.toThrow('SEED_AUTH_SESSIONS_FILE')
    expect(calls).toHaveLength(1)
  }
  const { client, calls } = fixture({}, 400)
  await expect(signInSeedAccount(client, 'fixture@example.test')).rejects.toThrow('Seed terms lookup failed (400)')
  expect(calls).toHaveLength(1)
})
