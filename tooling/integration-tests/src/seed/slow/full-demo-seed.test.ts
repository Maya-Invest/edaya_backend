import { DEV_AUTH_PASSWORD } from '@edaya/fixtures/demo-login'
import {
  DEV_AUTH_GUARDIAN_ACCOUNTS,
  DEV_AUTH_STAFF_ACCOUNTS,
  DEV_AUTH_TEACHER_ACCOUNTS,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
} from '@edaya/fixtures/meta/dev-auth-fixtures'
import { resolveSeedingApiKeyForSchool } from '@edaya/fixtures/meta/school-profiles'
import { SEED_SCHOOL_ID } from '@edaya/fixtures/shared/ids'
import {
  provisionSeedingServiceAccountHttp,
  runHttpDevSeeds,
} from '@edaya/seeding/http'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { apiPgliteEnv } from '../../support/api-pglite-env'
import {
  createCoreRouteTestApp,
  resetCoreRouteTestHarness,
} from '../../support/api-route-harness'
import { createHttpClientForApp } from '../../support/http-seed-client'

describe('runHttpDevSeeds', () => {
  let sharedApp: Awaited<ReturnType<typeof createCoreRouteTestApp>>
  let sharedClient: ReturnType<typeof createHttpClientForApp>
  let serviceAccountApiKey: string

  beforeAll(async () => {
    sharedApp = await createCoreRouteTestApp({
      withEmbeddedLocalFiles: true,
      autoCleanup: false,
    })
    sharedClient = createHttpClientForApp(sharedApp.app)

    const results = await runHttpDevSeeds({
      client: sharedClient,
      scope: 'all',
      provisionServiceAccount: true,
    })

    expect(results.school?.status).toBe('seeded')
    expect(results.access?.status).toBe('seeded')
    serviceAccountApiKey = resolveSeedingApiKeyForSchool(SEED_SCHOOL_ID)
  }, 120_000)

  afterAll(async () => {
    if (sharedApp?.runtime) {
      await sharedApp.runtime.close()
    }
    sharedApp?.localFiles?.stop()
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
      .toBe(DEV_AUTH_STAFF_ACCOUNTS.length + DEV_AUTH_TEACHER_ACCOUNTS.length + DEV_AUTH_GUARDIAN_ACCOUNTS.length)

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

  it('seeds the full demo school through HTTP session bootstrap', async () => {
    const { app, runtime, localFiles } = await createCoreRouteTestApp({
      withEmbeddedLocalFiles: true,
      autoCleanup: false,
    })
    const client = createHttpClientForApp(app)

    try {
      const results = await runHttpDevSeeds({
        client,
        scope: 'all',
        provisionServiceAccount: true,
      })

      expect(results.authProvision?.status).toBe('seeded')
      expect(results.school?.status).toBe('seeded')
      expect(results.access?.status).toBe('seeded')
    }
    finally {
      await runtime.close()
      localFiles?.stop()
    }
  }, 120_000)

  it('passes doctor health checks after HTTP seed', async () => {
    const doctor = await runHttpDevSeeds({
      client: sharedClient,
      scope: 'doctor',
      serviceAccountApiKey,
      provisionServiceAccount: false,
    })

    expect(doctor.doctor?.status).toBe('healthy')
  }, 60_000)

  it('re-seeds access and passes doctor through service account HTTP routes', async () => {
    const provisioned = await provisionSeedingServiceAccountHttp(sharedClient)
    expect(provisioned.status).toBe('skipped')
    expect(provisioned.apiKey).toBe(serviceAccountApiKey)

    const accessResults = await runHttpDevSeeds({
      client: sharedClient,
      scope: 'access',
      serviceAccountApiKey,
      provisionServiceAccount: false,
    })

    expect(accessResults.access?.status).toBe('seeded')

    const doctor = await runHttpDevSeeds({
      client: sharedClient,
      scope: 'doctor',
      serviceAccountApiKey,
      provisionServiceAccount: false,
    })
    expect(doctor.doctor?.status).toBe('healthy')
  }, 60_000)
})
