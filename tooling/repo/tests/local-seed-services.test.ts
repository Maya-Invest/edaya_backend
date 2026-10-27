import { expect, test } from 'bun:test'
import { waitForLocalSeedServices } from '../operations/local-seed-services'

const options = { apiUrl: 'http://localhost:9999', filesUrl: 'http://localhost:9200', appOrigin: 'http://localhost:5173', assertRunning: () => {}, timeoutMs: 1 }
test('reset waits for captured API and file storage before starting the seed', async () => {
  const previous = globalThis.fetch
  try {
    for (const ready of [true, false]) {
      const requests: string[] = []
      globalThis.fetch = Object.assign(async (url: string | URL | Request) => {
        requests.push(String(url))
        return String(url).endsWith('/health')
          ? new Response(null, { status: ready ? 200 : 503 })
          : Response.json({ otpAccess: true })
      }, { preconnect: previous.preconnect }) as typeof fetch
      if (ready)
        await waitForLocalSeedServices(options)
      else await expect(waitForLocalSeedServices(options)).rejects.toThrow('did not become ready')
      expect(requests).toEqual(['http://localhost:9999/auth/edaya/testing/capabilities', 'http://localhost:9200/health'])
    }
  }
  finally { globalThis.fetch = previous }
})

test('a crashed owned service aborts reset startup instead of seeding against another process', async () => {
  await expect(waitForLocalSeedServices({ ...options, assertRunning: () => {
    throw new Error('Owned service exited')
  } })).rejects.toThrow('Owned service exited')
})
