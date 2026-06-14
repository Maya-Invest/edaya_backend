import type { AppBindings } from '@/lib/http/types'
import {
  DEV_AUTH_PASSWORD,
  DEV_AUTH_STAFF_ACCOUNTS,
  SEED_ACTIVITY_ENROLLMENTS,
  SEED_EXTRACURRICULAR_ACTIVITIES,
} from '@edaya/dev-fixtures'
import { createHandlerAuthProvisioner, runDevAccessSeed, runDevAuthLink, runDevSchoolSeed } from '@edaya/seeding'
import { afterEach, describe, expect, it } from 'bun:test'
import { Hono } from 'hono'
import indexRouter from '@/app-router'
import { dependenciesInjection } from '@/lib/http/dependencies'
import { getApiRuntime, resetApiRuntimesForTests } from '@/lib/runtime/registry'
import {
  apiPgliteEnv,
  collectSetCookieHeaders,
  createApiPgliteTestEnv,
  createAppRequest,
  createCoreRouteTestApp,
} from '../support/api-route-harness'

function unwrapEntityList<T>(values: unknown): T[] {
  if (!Array.isArray(values)) {
    return []
  }
  return values.map((entry) => {
    if (entry && typeof entry === 'object' && 'data' in entry && Object.keys(entry).length === 1) {
      return (entry as { data: T }).data
    }
    return entry as T
  })
}

describe('demo login accounts route', () => {
  afterEach(async () => {
    await resetApiRuntimesForTests()
  })

  async function createAppWithEnv(env: ReturnType<typeof createApiPgliteTestEnv>) {
    await resetApiRuntimesForTests()
    await getApiRuntime(env)

    const app = new Hono<AppBindings>()
    app.use(async (c, next) => {
      c.env = env
      await next()
    })
    app.use(dependenciesInjection)
    app.route('/', indexRouter)

    return app
  }

  it('returns linked staff demo accounts without authentication in development', async () => {
    const { app, runtime, application } = await createCoreRouteTestApp()
    await runDevSchoolSeed(application)
    await runDevAuthLink(application, createHandlerAuthProvisioner(runtime.getAuth(), apiPgliteEnv.BETTER_AUTH_URL))
    await runDevAccessSeed(application)

    const response = await app.request(createAppRequest('/core/auth/demo-login-accounts/list', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }))

    expect(response.status).toBe(200)

    const demoAccounts = await response.json() as Array<{
      staffId: string
      email: string
      role: string
    }>

    expect(demoAccounts).toHaveLength(4)
    expect(demoAccounts.find(account => account.staffId === 'st5')).toMatchObject({
      email: 'c.moreau@school.edu',
      role: 'directeur',
    })
  }, 30_000)

  it('returns 503 when demo login accounts are disabled in production', async () => {
    const productionEnv = createApiPgliteTestEnv({
      NODE_ENV: 'production',
      ALLOW_DEMO_LOGIN_ACCOUNTS: false,
    })

    const app = await createAppWithEnv(productionEnv)

    const response = await app.request(createAppRequest('/core/auth/demo-login-accounts/list', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }))

    expect(response.status).toBe(503)
  })
})

describe('dev activities seed', () => {
  afterEach(async () => {
    await resetApiRuntimesForTests()
  })

  it('seeds extracurricular activities and enrollments and exposes them via entity routes', async () => {
    const { app, runtime, application } = await createCoreRouteTestApp()
    const seedResult = await runDevSchoolSeed(application)
    expect(seedResult.status).toBe('seeded')
    if (seedResult.status === 'seeded') {
      expect(seedResult.activities).toBe(SEED_EXTRACURRICULAR_ACTIVITIES.length)
      expect(seedResult.activityEnrollments).toBe(SEED_ACTIVITY_ENROLLMENTS.length)
    }

    await runDevAuthLink(application, createHandlerAuthProvisioner(runtime.getAuth(), apiPgliteEnv.BETTER_AUTH_URL))
    await runDevAccessSeed(application)

    const signIn = await app.request(createAppRequest('/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: DEV_AUTH_STAFF_ACCOUNTS[1].email, password: DEV_AUTH_PASSWORD }),
    }))
    const cookies = collectSetCookieHeaders(signIn)
    const authHeaders = {
      'content-type': 'application/json',
      'cookie': cookies.join('; '),
    }

    const [activitiesResponse, enrollmentsResponse] = await Promise.all([
      app.request(createAppRequest('/core/entities/activities/list', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/activity-enrollments/list', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({}),
      })),
    ])

    expect(activitiesResponse.status).toBe(200)
    expect(enrollmentsResponse.status).toBe(200)

    const activities = unwrapEntityList<{ id: string, name: string, capacity: number, participants: number }>(
      await activitiesResponse.json(),
    )
    const enrollments = unwrapEntityList<{ activityId: string, studentId: string, status: string }>(
      await enrollmentsResponse.json(),
    )

    expect(activities.length).toBe(SEED_EXTRACURRICULAR_ACTIVITIES.length)
    expect(activities.find(activity => activity.id === 'act-robot')).toMatchObject({
      name: 'Club Robotique',
      capacity: 24,
      participants: 18,
    })
    expect(enrollments.some(enrollment => (
      enrollment.activityId === 'act-robot'
      && enrollment.studentId === 's1'
      && enrollment.status === 'approved'
    ))).toBe(true)
    expect(enrollments.some(enrollment => (
      enrollment.activityId === 'act-robot'
      && enrollment.studentId === 's3'
      && enrollment.status === 'denied'
    ))).toBe(true)
  }, 30_000)
})
