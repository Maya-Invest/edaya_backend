import { probeLocalApiReachable } from '@edaya/seeding/cli'
import { expect, test } from 'bun:test'

test('local reset refuses unhealthy and nonresponding API listeners', async () => {
  for (const stalled of [false, true]) {
    const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => stalled ? new Promise<Response>(() => {}) : new Response('Database failed', { status: 500 }) })
    const url = `http://localhost:${server.port}`
    try {
      expect(await probeLocalApiReachable(url)).toBe(true)
    }
    finally { await server.stop(true) }
    expect(await probeLocalApiReachable(url)).toBe(false)
  }
})

test('local reset cannot target a remote service', async () => {
  await expect(probeLocalApiReachable('https://example.com')).rejects.toThrow('loopback')
})
