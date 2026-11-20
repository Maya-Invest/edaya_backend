import { describe, expect, test } from 'bun:test'
import { HttpSeedClient } from './client'
import { isSeedingServiceAccountApiKeyReady } from './verify-service-account'

describe('seeding service-account readiness', () => {
  function client(body: unknown, status = 200) {
    return new HttpSeedClient({ baseUrl: 'http://localhost:3000', fetch: async url =>
      String(url).includes('effective-grants') ? Response.json(body, { status }) : Response.json([]) })
  }

  test('requires the canonical action with school scope in the current projection', async () => {
    expect(await isSeedingServiceAccountApiKeyReady(client({ grants: [{ permission: 'ATTACHMENT_CONFIGURE', scopes: [{ kind: 'school' }] }] }), 'sk_live_test')).toBe(true)
    expect(await isSeedingServiceAccountApiKeyReady(client({ grants: [{ permission: 'ATTACHMENT_READ', scopes: [{ kind: 'school' }] }] }), 'sk_live_test')).toBe(false)
    expect(await isSeedingServiceAccountApiKeyReady(client({ grants: [] }), 'sk_live_test')).toBe(false)
  })

  test('rejects missing credentials, rejected requests and the replaced response shape', async () => {
    expect(await isSeedingServiceAccountApiKeyReady(client({}), undefined)).toBe(false)
    expect(await isSeedingServiceAccountApiKeyReady(client({}, 403), 'sk_live_test')).toBe(false)
    expect(await isSeedingServiceAccountApiKeyReady(client({ effectiveGrants: { isElevated: true, permissions: ['ATTACHMENT_CONFIGURE'] } }), 'sk_live_test')).toBe(false)
  })
})
