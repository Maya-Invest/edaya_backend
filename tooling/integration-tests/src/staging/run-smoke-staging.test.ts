import type { HttpFetch } from '@edaya/seeding/http'
import { SEED_SCHOOL_ID } from '@edaya/fixtures/shared/ids'
import { HttpSeedClient } from '@edaya/seeding/http'
import { afterEach, describe, expect, it } from 'bun:test'
import { loadSmokeStagingEnv } from './load-smoke-env'
import { runSmokeStaging } from './run-smoke-staging'

const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('loadSmokeStagingEnv', () => {
  it('defaults staging URLs when env vars are unset', () => {
    delete process.env.SEED_STAGING_API_URL
    delete process.env.SEED_STAGING_AUTH_URL
    delete process.env.SEED_STAGING_APP_ORIGIN

    const env = loadSmokeStagingEnv({ loadEnvFile: false })
    expect(env.apiUrl).toBe('https://staging.school.api.edayaplus.com')
    expect(env.authUrl).toBe('https://staging.identity.api.edayaplus.com')
    expect(env.appOrigin).toBe('https://staging.app.edayaplus.com')
  })

  it('uses SEED_STAGING_API_URL when set', () => {
    process.env.SEED_STAGING_API_URL = 'https://api-staging.example.com/'
    process.env.SEED_STAGING_AUTH_URL = 'https://identity-staging.example.com/'
    process.env.SEED_STAGING_APP_ORIGIN = 'https://app-staging.example.com'

    const env = loadSmokeStagingEnv({ loadEnvFile: false })
    expect(env.apiUrl).toBe('https://api-staging.example.com')
    expect(env.authUrl).toBe('https://identity-staging.example.com')
    expect(env.appOrigin).toBe('https://app-staging.example.com')
  })

  it('uses the school profile seeding API key by default', () => {
    delete process.env.SEED_SCHOOL_ID

    const env = loadSmokeStagingEnv({ loadEnvFile: false })
    expect(env.serviceAccountApiKey).toBe('sk_live_dev_edaya_central_seeding_integration_key')
  })
})

describe('runSmokeStaging', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('passes tier-1 checks against a mocked healthy staging API', async () => {
    process.env.SMOKE_STAGING_LOAD_ENV_FILE = '0'
    process.env.SEED_STAGING_API_URL = 'http://localhost:9999'
    process.env.SEED_STAGING_APP_ORIGIN = 'https://app-staging.test'

    const fetchImpl: HttpFetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const method = init?.method ?? 'GET'

      if (url.endsWith('/') && method === 'GET') {
        return new Response(JSON.stringify({ message: 'Edaya Core API' }), { status: 200 })
      }

      if (url.endsWith('/doc') && method === 'GET') {
        return new Response('{}', { status: 200 })
      }

      if (url.endsWith('/core/entities/schools/list') && method === 'OPTIONS') {
        const origin = new Headers(init?.headers).get('Origin')
        if (origin === 'https://app-staging.test') {
          return new Response(null, {
            status: 204,
            headers: {
              'access-control-allow-origin': origin,
              'access-control-allow-credentials': 'true',
            },
          })
        }

        return new Response(null, { status: 204 })
      }

      if (url.endsWith('/auth/edaya/otp/start'))
        return Response.json({ challenge: 'mock-challenge' })
      if (url.includes('/auth/edaya/dev/last-otp'))
        return Response.json({ otp: '123456' })
      if (url.endsWith('/auth/edaya/otp/verify') && method === 'POST') {
        return new Response(JSON.stringify({ user: { id: 'user-1' } }), {
          status: 200,
          headers: {
            'set-cookie': 'edaya_session=session-token; Path=/; HttpOnly',
          },
        })
      }

      if (url.endsWith('/auth/edaya/access-token') && method === 'POST') {
        return new Response(JSON.stringify({
          accessToken: 'identity-jwt',
          expiresAt: '2030-01-01T00:00:00.000Z',
        }), { status: 200 })
      }

      if (url.endsWith('/core/authorization/effective-grants') && method === 'GET') {
        return new Response(JSON.stringify({
          kind: 'staff',
          grants: [{ permission: 'STUDENT_READ', source: 'manual', scopes: [{ kind: 'school' }], academicYearId: 'year' }],
        }), { status: 200 })
      }

      if (url.endsWith('/core/entities/schools/list') && method === 'POST') {
        const auth = new Headers(init?.headers).get('authorization')
        if (auth?.startsWith('Bearer ')) {
          return new Response(JSON.stringify([{ data: { id: SEED_SCHOOL_ID } }]), { status: 200 })
        }

        return new Response(JSON.stringify([{ data: { id: SEED_SCHOOL_ID } }]), { status: 200 })
      }

      return new Response('not found', { status: 404 })
    }

    const env = loadSmokeStagingEnv({ loadEnvFile: false })
    const client = new HttpSeedClient({ baseUrl: env.apiUrl, fetch: fetchImpl })

    // Patch runSmokeStaging to use our client by testing through the exported helpers indirectly:
    // runSmokeStaging creates its own client, so we rely on global fetch mock above.
    globalThis.fetch = fetchImpl as typeof fetch

    const result = await runSmokeStaging()

    expect(result.passed).toBe(true)
    expect(result.checks.filter(check => check.status === 'failed')).toHaveLength(0)
    expect(result.checks.find(check => check.id === 'S7')?.status).toBe('passed')

    // Ensure mocked client path still works for direct usage.
    expect(client.origin).toBe('https://api-staging.test')
  })
})
