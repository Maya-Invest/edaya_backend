import type { AuthSessionProvider } from '@/http/dependencies/session-actor'
import type { AppBindings } from '@/http/types'
import { DEV_AUTH_PASSWORD } from '@edaya/fixtures/demo-login'
import {
  DEV_AUTH_GUARDIAN_ACCOUNTS,
  DEV_AUTH_STAFF_ACCOUNTS,
  MINIMAL_AUTH_FIXTURE_GUARDIAN_ID,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  MINIMAL_AUTH_FIXTURE_STAFF_ID,
} from '@edaya/fixtures/meta/dev-auth-fixtures'
import {
  createHandlerAuthProvisioner,
  createInProcessAuthLinkSeedPort,
  runDevAuthLinkWithPort,
  runDevAuthProvision,
  runDevSchoolSeed,
} from '@edaya/seeding'
import { afterEach, describe, expect, it } from 'bun:test'
import { Hono } from 'hono'
import { createDependenciesInjection } from '@/http/dependencies'
import { createSessionActorDependency } from '@/http/dependencies/session-actor'
import { getApiRuntime, resetApiRuntimesForTests } from '@/runtime/local/registry'
import { apiPgliteEnv } from '../support/api-pglite-env'

function collectSetCookieHeaders(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie()
  }

  const single = response.headers.get('set-cookie')
  return single ? [single] : []
}

describe('auth link seed port', () => {
  afterEach(async () => {
    await resetApiRuntimesForTests()
  })

  it('provisions Better Auth users without school data', async () => {
    const runtime = await getApiRuntime(apiPgliteEnv)
    const auth = createHandlerAuthProvisioner(runtime.getAuth(), apiPgliteEnv.BETTER_AUTH_URL)

    const result = await runDevAuthProvision(auth)

    expect(result.status).toBe('seeded')
    expect(result.accounts.length).toBe(DEV_AUTH_STAFF_ACCOUNTS.length + DEV_AUTH_GUARDIAN_ACCOUNTS.length)

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

  it('links seeded accounts and resolves the staff actor from the session cookie', async () => {
    const runtime = await getApiRuntime(apiPgliteEnv)
    const application = await runtime.getSchoolApplication()
    const auth = createHandlerAuthProvisioner(runtime.getAuth(), apiPgliteEnv.BETTER_AUTH_URL)

    await runDevSchoolSeed(application)
    const authLinkPort = createInProcessAuthLinkSeedPort(application)
    const result = await runDevAuthLinkWithPort(authLinkPort, auth)

    expect(result.status).toBe('seeded')
    expect(result.linkedStaff).toBe(DEV_AUTH_STAFF_ACCOUNTS.length)
    expect(result.linkedGuardians).toBe(DEV_AUTH_GUARDIAN_ACCOUNTS.length)

    const staff = await application.repositories.staffMembers.findById(MINIMAL_AUTH_FIXTURE_STAFF_ID)
    const guardian = await application.repositories.guardians.findById(MINIMAL_AUTH_FIXTURE_GUARDIAN_ID)

    expect(staff?.subjectId).toBeTruthy()
    expect(guardian?.subjectId).toBeTruthy()

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

    const cookies = collectSetCookieHeaders(signInResponse)
    const app = new Hono<AppBindings>()
    app.use(async (c, next) => {
      c.env = apiPgliteEnv
      await next()
    })
    app.use(async (c, next) => {
      c.set('schoolApp', application)
      await next()
    })
    app.use(createDependenciesInjection([
      createSessionActorDependency(() => runtime.getAuth() as unknown as AuthSessionProvider),
    ]))
    app.get('/actor', c => c.json({ actor: c.get('actor') }))

    const actorResponse = await app.request('/actor', {
      headers: {
        cookie: cookies.join('; '),
      },
    })

    expect(actorResponse.status).toBe(200)

    const body = await actorResponse.json() as {
      actor: {
        kind: string
        staffMemberId: string
        subjectId: string
      } | null
    }

    expect(body.actor?.kind).toBe('staff')
    expect(body.actor?.staffMemberId).toBe(MINIMAL_AUTH_FIXTURE_STAFF_ID)
    expect(body.actor?.subjectId).toBe(staff?.subjectId)

    const secondRun = await runDevAuthLinkWithPort(authLinkPort, auth)
    expect(secondRun.status).toBe('skipped')
    if (secondRun.status === 'skipped') {
      expect(secondRun.reason).toBe('already-linked')
    }
  }, 90_000)
})
