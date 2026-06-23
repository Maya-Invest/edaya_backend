import {
  DEV_AUTH_GUARDIAN_ACCOUNTS,
  DEV_AUTH_PASSWORD,
  DEV_AUTH_STAFF_ACCOUNTS,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  resolveSeedingApiKeyForSchool,
  SEED_SCHOOL_ID,
} from '@edaya/dev-fixtures'
import {
  HttpSeedClient,
  provisionSeedingServiceAccountInProcess,
  runHttpDevSeeds,
} from '@edaya/seeding/http'
import { afterAll, beforeAll, expect, it } from 'bun:test'
import {
  apiPgliteEnv,
  createCoreRouteTestApp,
  resetCoreRouteTestHarness,
} from '../support/api-route-harness'
import { describeSlowIntegration } from '../support/seeded-route-test-context'

function createHttpClientForApp(app: Awaited<ReturnType<typeof createCoreRouteTestApp>>['app']): HttpSeedClient {
  return new HttpSeedClient({
    baseUrl: apiPgliteEnv.BETTER_AUTH_URL,
    fetch: async (input, init) => {
      const url = new URL(input.toString())
      return await app.request(`${url.pathname}${url.search}`, init)
    },
  })
}

describeSlowIntegration('runHttpDevSeeds', () => {
  let sharedApp: Awaited<ReturnType<typeof createCoreRouteTestApp>>

  beforeAll(async () => {
    sharedApp = await createCoreRouteTestApp({ autoCleanup: false })
  }, 60_000)

  afterAll(async () => {
    if (sharedApp?.runtime) {
      await sharedApp.runtime.close()
    }
    await resetCoreRouteTestHarness()
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
    const { app, application } = sharedApp
    const client = createHttpClientForApp(app)

    const results = await runHttpDevSeeds({
      client,
      scope: 'all',
      application,
    })

    expect(results.authProvision?.status).toBe('seeded')
    expect(results.school?.status).toBe('seeded')
    expect(results.access?.status).toBe('seeded')
  }, 60_000)

  it('passes smoke checks after HTTP auth and domain seed', async () => {
    const { app, application } = sharedApp
    const client = createHttpClientForApp(app)

    const smoke = await runHttpDevSeeds({
      client,
      scope: 'smoke',
      application,
    })

    expect(smoke.smoke?.status).toBe('passed')
  }, 60_000)

  it('seeds the full demo school through HTTP session bootstrap without in-process application access', async () => {
    const { app } = await createCoreRouteTestApp()
    const client = createHttpClientForApp(app)

    const results = await runHttpDevSeeds({
      client,
      scope: 'all',
      provisionServiceAccount: true,
    })

    expect(results.authProvision?.status).toBe('seeded')
    expect(results.school?.status).toBe('seeded')
    expect(results.access?.status).toBe('seeded')

    const smoke = await runHttpDevSeeds({
      client,
      scope: 'smoke',
      serviceAccountApiKey: resolveSeedingApiKeyForSchool(SEED_SCHOOL_ID),
      provisionServiceAccount: false,
    })
    expect(smoke.smoke?.status).toBe('passed')
  }, 120_000)

  it('seeds the full demo school through service account HTTP routes', async () => {
    const { app, application } = await createCoreRouteTestApp()

    const bootstrap = await runHttpDevSeeds({
      client: createHttpClientForApp(app),
      scope: 'all',
      application,
      provisionServiceAccount: false,
    })

    expect(bootstrap.authProvision?.status).toBe('seeded')
    expect(bootstrap.school?.status).toBe('seeded')
    expect(bootstrap.access?.status).toBe('seeded')

    const provisioned = await provisionSeedingServiceAccountInProcess(application)
    expect(provisioned.status).toBe('created')
    expect(provisioned.apiKey).toBe(resolveSeedingApiKeyForSchool(SEED_SCHOOL_ID))

    const client = createHttpClientForApp(app)
    const results = await runHttpDevSeeds({
      client,
      scope: 'access',
      serviceAccountApiKey: provisioned.apiKey,
      provisionServiceAccount: false,
    })

    expect(results.access?.status).toBe('seeded')

    const schools = await runHttpDevSeeds({
      client,
      scope: 'smoke',
      serviceAccountApiKey: provisioned.apiKey,
    })
    expect(schools.smoke?.status).toBe('passed')
  }, 120_000)
})
