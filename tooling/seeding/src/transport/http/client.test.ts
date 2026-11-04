import { describe, expect, it } from 'bun:test'
import { HttpSeedClient } from './client'

const TEST_IDENTITY_JWT = 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.signature'

describe('HttpSeedClient.request', () => {
  it('does not attach API session headers to external presigned storage URLs', async () => {
    let capturedHeaders: Headers | undefined
    const client = new HttpSeedClient({
      baseUrl: 'http://localhost:9999',
      appOrigin: 'http://localhost:5173',
      fetch: async (_input, init) => {
        capturedHeaders = new Headers(init?.headers)
        return new Response(null, { status: 200 })
      },
    })

    ;(client as unknown as { cookies: Map<string, string> }).cookies.set(
      'better-auth.session_token',
      'session-token',
    )

    await client.request('https://bucket.account.r2.cloudflarestorage.com/object?sig=abc', {
      method: 'PUT',
      headers: { 'content-type': 'image/jpeg' },
    })

    expect(capturedHeaders?.get('cookie')).toBeNull()
    expect(capturedHeaders?.get('origin')).toBeNull()
    expect(capturedHeaders?.get('content-type')).toBe('image/jpeg')
  })

  it('exchanges renewal cookies and sends only Bearer on business requests', async () => {
    let capturedHeaders: Headers | undefined
    const client = new HttpSeedClient({
      baseUrl: 'http://localhost:9999',
      appOrigin: 'http://localhost:5173',
      fetch: async (input, init) => {
        if (String(input).endsWith('/auth/edaya/access-token')) {
          expect(new Headers(init?.headers).get('cookie')).toContain('session-token')
          expect(init?.body).toBe(JSON.stringify({ resource: 'http://localhost:9999' }))
          return Response.json({ accessToken: TEST_IDENTITY_JWT, expiresAt: new Date(Date.now() + 300000).toISOString() })
        }
        capturedHeaders = new Headers(init?.headers)
        return new Response(null, { status: 200 })
      },
    })

    ;(client as unknown as { cookies: Map<string, string> }).cookies.set(
      'better-auth.session_token',
      'session-token',
    )

    await client.request('/core/files/upload-intents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    })

    expect(capturedHeaders?.get('cookie')).toBeNull()
    expect(capturedHeaders?.get('authorization')).toBe(`Bearer ${TEST_IDENTITY_JWT}`)
    expect(capturedHeaders?.get('origin')).toBe('http://localhost:5173')
  })

  it('paces API-origin requests on staging.api.edayaplus.com', async () => {
    let requestCount = 0
    const client = new HttpSeedClient({
      baseUrl: 'https://staging.api.edayaplus.com',
      fetch: async () => {
        requestCount += 1
        return new Response(null, { status: 200 })
      },
    })

    const startedAt = Date.now()
    await client.request('/core/entities/schools/list', { method: 'POST' })
    await client.request('/core/entities/schools/list', { method: 'POST' })
    const elapsedMs = Date.now() - startedAt

    expect(requestCount).toBe(2)
    expect(elapsedMs).toBeGreaterThanOrEqual(5)
  })

  it('does not pace non-API presigned storage uploads on staging', async () => {
    let requestCount = 0
    const client = new HttpSeedClient({
      baseUrl: 'https://staging.api.edayaplus.com',
      fetch: async () => {
        requestCount += 1
        return new Response(null, { status: 200 })
      },
    })

    const startedAt = Date.now()
    await client.request('https://bucket.account.r2.cloudflarestorage.com/a?sig=1', { method: 'PUT' })
    await client.request('https://bucket.account.r2.cloudflarestorage.com/b?sig=2', { method: 'PUT' })
    const elapsedMs = Date.now() - startedAt

    expect(requestCount).toBe(2)
    expect(elapsedMs).toBeLessThan(50)
  })
  it('keeps the original token across temporary account provisioning', async () => {
    let exchanges = 0
    const client = new HttpSeedClient({
      baseUrl: 'http://localhost:9999',
      fetch: async (input) => {
        if (String(input).endsWith('/auth/edaya/access-token')) {
          exchanges++
          return Response.json({ accessToken: TEST_IDENTITY_JWT, expiresAt: new Date(Date.now() + 300000).toISOString() })
        }
        return new Response(null, { status: 200 })
      },
    })
    client.absorbCookies(new Response(null, { headers: { 'set-cookie': 'better-auth.session_token=original' } }))
    for (let i = 0; i < 35; i++) {
      await client.withCookieSnapshot(async () => {
        client.absorbCookies(new Response(null, { headers: { 'set-cookie': 'better-auth.session_token=temporary' } }))
      })
    }
    await client.request('/core/entities/schools/list', { method: 'POST' })
    expect(exchanges).toBe(1)
    expect(client.cookieHeader()).toContain('original')
  })

  it('restores the primary staff scope after a secondary campus and respects explicit profiles', async () => {
    const scopes: Array<(string | null)[]> = []
    const client = new HttpSeedClient({
      baseUrl: 'http://localhost:9999',
      fetch: async (input, init) => {
        if (String(input).endsWith('/auth/edaya/access-token'))
          return Response.json({ accessToken: TEST_IDENTITY_JWT, expiresAt: new Date(Date.now() + 300000).toISOString() })
        const headers = new Headers(init?.headers)
        scopes.push(['x-actor-kind', 'x-school-id', 'x-actor-id'].map(key => headers.get(key)))
        return new Response(null)
      },
    })
    client.absorbCookies(new Response(null, { headers: { 'set-cookie': 'edaya_session=fixture' } }))
    client.selectStaffScope({ schoolId: 'primary', actorId: 'staff-a' })
    const grants = '/core/authorization/effective-grants'
    await client.withCookieSnapshot(async () => {
      client.selectStaffScope({ schoolId: 'secondary', actorId: 'staff-b' })
      await client.request(grants)
    })
    await client.request(grants)
    await client.request(grants, { headers: { 'x-actor-kind': 'platform' } })
    expect(scopes).toEqual([['staff', 'secondary', 'staff-b'], ['staff', 'primary', 'staff-a'], ['platform', null, null]])
  })

  it('retries identity POST 429 using Retry-After without replaying school writes', async () => {
    let identityCalls = 0
    const client = new HttpSeedClient({
      baseUrl: 'http://localhost:9999',

      fetch: async (input) => {
        if (String(input).includes('/auth/sign-in/email')) {
          identityCalls += 1
          if (identityCalls === 1) {
            return new Response(null, { status: 429, headers: { 'retry-after': '0' } })
          }
          return new Response(null, { status: 200 })
        }
        return new Response(null, { status: 429, headers: { 'retry-after': '0' } })
      },
    })

    const identity = await client.request('/auth/sign-in/email', { method: 'POST' })
    const school = await client.request('/core/commands/pay', { method: 'POST' })

    expect(identityCalls).toBe(2)
    expect(identity.status).toBe(200)
    expect(school.status).toBe(429)
  })

  it('does not replay writes after a transient status or malformed response', async () => {
    for (const response of [{ body: null, status: 503 }, { body: '<html>unavailable</html>', status: 502 }, { body: 'invalid', status: 200 }]) {
      let calls = 0
      const client = new HttpSeedClient({
        baseUrl: 'https://staging.api.edayaplus.com',
        fetch: async () => {
          calls++
          return new Response(response.body, { status: response.status })
        },
      })
      await client.jsonRequest('/core/commands/pay', { method: 'POST' }).catch(() => undefined)
      expect(calls).toBe(1)
    }
  })
})
