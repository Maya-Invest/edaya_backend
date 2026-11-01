import type { Transport } from '@maya-invest/edaya-api-client'
import { createAuthClient, createSchoolClient } from '@maya-invest/edaya-api-client'
import { expect, test } from 'bun:test'

test('auth namespace uses the supplied session transport without token recursion', async () => {
  const calls: Array<{ method: string, path: string, body: unknown }> = []
  const transport: Transport = { async request<T>(method: string, path: string, options?: { body?: unknown }) {
    calls.push({ method, path, body: options?.body })
    return (path.endsWith('/access-token') ? { accessToken: 'jwt', expiresIn: 300 } : { state: 'primary_required', challenge: 'challenge' }) as T
  } }
  const auth = createAuthClient(transport)
  await auth.startOtp({ kind: 'email', value: 'test@example.test' })
  const token = await auth.accessToken({ resource: 'https://api.edayaplus.com' })
  expect(token.accessToken).toBe('jwt')
  expect(calls).toEqual([
    { method: 'POST', path: '/auth/edaya/otp/start', body: { kind: 'email', value: 'test@example.test' } },
    { method: 'POST', path: '/auth/edaya/access-token', body: { resource: 'https://api.edayaplus.com' } },
  ])
  expect(typeof createSchoolClient(transport).auth.getSession).toBe('function')
  expect(typeof createSchoolClient(transport).entities.staffMembers).toBe('object')
})
