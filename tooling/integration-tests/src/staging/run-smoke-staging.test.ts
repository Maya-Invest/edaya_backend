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
    delete process.env.STAGING_API_URL
    delete process.env.STAGING_APP_ORIGIN
    delete process.env.SEED_API_URL

    const env = loadSmokeStagingEnv()
    expect(env.apiUrl).toBe('https://api-staging.edaya.softilab.dev')
    expect(env.appOrigin).toBe('https://app-staging.edaya.softilab.dev')
  })

  it('prefers STAGING_API_URL over SEED_API_URL', () => {
    process.env.STAGING_API_URL = 'https://api-staging.example.com/'
    process.env.SEED_API_URL = 'https://api.example.com'

    const env = loadSmokeStagingEnv()
    expect(env.apiUrl).toBe('https://api-staging.example.com')
  })

  it('uses the school profile seeding API key by default', () => {
    delete process.env.SEED_SCHOOL_ID

    const env = loadSmokeStagingEnv({ loadEnvFile: false })
    expect(env.serviceAccountApiKey).toBe('sk_live_dev_edaya_central_seeding_integration_key')
  })
})

describe('runSmokeStaging', () => {
  it('passes tier-1 checks against a mocked healthy staging API', async () => {
    process.env.SMOKE_STAGING_LOAD_ENV_FILE = '0'
    process.env.STAGING_API_URL = 'https://api-staging.test'
    process.env.STAGING_APP_ORIGIN = 'https://app-staging.test'

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

      if (url.endsWith('/auth/sign-in/email') && method === 'POST') {
        return new Response(JSON.stringify({ user: { id: 'user-1' } }), {
          status: 200,
          headers: {
            'set-cookie': 'better-auth.session_token=session-token; Path=/; HttpOnly',
          },
        })
      }

      if (url.endsWith('/core/authorization/effective-grants') && method === 'GET') {
        return new Response(JSON.stringify({
          kind: 'staff',
          effectiveGrants: { permissions: ['STUDENT_READ'], scopeGrants: [], isElevated: false },
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

    const env = loadSmokeStagingEnv()
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
