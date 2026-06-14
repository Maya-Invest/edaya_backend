import type { AppBindings } from '@/http/types'
import {
  DEV_AUTH_GUARDIAN_ACCOUNTS,
  DEV_AUTH_PASSWORD,
  DEV_AUTH_STAFF_ACCOUNTS,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  SEED_SCHOOL_ID,
} from '@edaya/dev-fixtures'
import {
  HttpSeedClient,
  runHttpDevSeeds,
} from '@edaya/seeding/http'
import { afterEach, describe, expect, it } from 'bun:test'
import { Hono } from 'hono'
import indexRouter from '@/app-router'
import { dependenciesInjection } from '@/http/dependencies'
import { getApiRuntime, resetApiRuntimesForTests } from '@/runtime'
import {
  apiPgliteEnv,
  createApiPgliteTestEnv,
  createCoreRouteTestApp,
} from '../support/api-route-harness'

const SYSTEM_ACTOR_SECRET = 'test-system-secret'

function createHttpClientForApp(app: Awaited<ReturnType<typeof createCoreRouteTestApp>>['app']): HttpSeedClient {
  return new HttpSeedClient({
    baseUrl: apiPgliteEnv.BETTER_AUTH_URL,
    fetch: async (input, init) => {
      const url = new URL(input.toString())
      return await app.request(`${url.pathname}${url.search}`, init)
    },
  })
}

describe('runHttpDevSeeds', () => {
  afterEach(async () => {
    await resetApiRuntimesForTests()
  })

  it('provisions Better Auth users through HTTP sign-up/sign-in', async () => {
    const { app, runtime } = await createCoreRouteTestApp()
    const client = createHttpClientForApp(app)

    const results = await runHttpDevSeeds({
      client,
      scope: 'auth',
    })

    expect(results.authProvision?.status).toBe('seeded')
    expect(results.authProvision?.accounts.length)
      .toBe(DEV_AUTH_STAFF_ACCOUNTS.length + DEV_AUTH_GUARDIAN_ACCOUNTS.length)

    const signInResponse = await runtime.getAuth().handler(new Request(`${apiPgliteEnv.BETTER_AUTH_URL}/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
        password: DEV_AUTH_PASSWORD,
      }),
    }))

    expect(signInResponse.status).toBe(200)
  }, 30_000)

  it('seeds the full demo school when auth goes through HTTP', async () => {
    const { app, application } = await createCoreRouteTestApp()
    const client = createHttpClientForApp(app)

    const results = await runHttpDevSeeds({
      client,
      scope: 'all',
      application,
    })

    expect(results.authProvision?.status).toBe('seeded')
    expect(results.school?.status).toBe('seeded')
    expect(results.authLink?.status).toBe('seeded')
    expect(results.access?.status).toBe('seeded')
  }, 60_000)

  it('passes smoke checks after HTTP auth and domain seed', async () => {
    const { app, application } = await createCoreRouteTestApp()
    const client = createHttpClientForApp(app)

    await runHttpDevSeeds({
      client,
      scope: 'all',
      application,
    })

    const smoke = await runHttpDevSeeds({
      client,
      scope: 'smoke',
      application,
    })

    expect(smoke.smoke?.status).toBe('passed')
  }, 60_000)

  it('seeds the full demo school through system HTTP routes', async () => {
    await resetApiRuntimesForTests()
    const env = createApiPgliteTestEnv({ SYSTEM_ACTOR_SECRET })
    const runtime = await getApiRuntime(env)
    const app = new Hono<AppBindings>()
    app.use(async (c, next) => {
      c.env = env
      await next()
    })
    app.use(dependenciesInjection)
    app.route('/', indexRouter)
    const client = createHttpClientForApp(app)

    const results = await runHttpDevSeeds({
      client,
      scope: 'all',
      systemActorSecret: SYSTEM_ACTOR_SECRET,
    })

    expect(results.authProvision?.status).toBe('seeded')
    expect(results.school?.status).toBe('seeded')
    expect(results.authLink?.status).toBe('seeded')
    expect(results.access?.status).toBe('seeded')

    const application = await runtime.getSchoolApplication()
    const school = await application.repositories.schools.findById(SEED_SCHOOL_ID)
    expect(school?.id).toBe(SEED_SCHOOL_ID)
  }, 120_000)
})
