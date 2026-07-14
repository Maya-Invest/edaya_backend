import { describe, expect, it } from 'bun:test'
import { HttpSeedClient } from './client'

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

  it('still attaches session headers to API-origin requests', async () => {
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

    await client.request('/core/files/upload-intents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    })

    expect(capturedHeaders?.get('cookie')).toContain('better-auth.session_token=session-token')
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
})
