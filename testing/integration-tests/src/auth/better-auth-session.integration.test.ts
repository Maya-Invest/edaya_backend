import { Guardian, StaffMember } from '@edaya/core'
import {
  DEV_AUTH_PASSWORD,
  MINIMAL_AUTH_FIXTURE_GUARDIAN_ID,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  MINIMAL_AUTH_FIXTURE_STAFF_ID,
  seedMinimalSchoolFixtures,
} from '@edaya/dev-fixtures'
import { afterEach, describe, expect, it } from 'bun:test'
import {
  collectSetCookieHeaders,
  countAccountRowsForUser,
  countAuthTableRows,
  createAuthIntegrationContext,
  createSessionActorApp,
  ensureAuthUser,
  findUserByEmail,
  linkStaffMemberToAuthUser,
  mountEffectiveGrantsRoute,
  signInEmail,
  signUpEmail,
} from './support/better-auth-harness'

describe('Better Auth session integration', () => {
  const contexts: Array<Awaited<ReturnType<typeof createAuthIntegrationContext>>> = []

  afterEach(async () => {
    while (contexts.length > 0) {
      const context = contexts.pop()
      if (context) {
        await context.pglite.close()
      }
    }
  })

  async function openContext() {
    const context = await createAuthIntegrationContext()
    contexts.push(context)
    return context
  }

  it('sign-up creates rows in auth tables', async () => {
    const { db, auth, env } = await openContext()

    expect(await countAuthTableRows(db, 'user')).toBe(0)
    expect(await countAuthTableRows(db, 'account')).toBe(0)

    const signUpResponse = await signUpEmail(auth, env, {
      email: 'teacher@school.edu',
      password: DEV_AUTH_PASSWORD,
      name: 'Teacher User',
    })

    expect(signUpResponse.status).toBe(200)

    const user = await findUserByEmail(db, 'teacher@school.edu')
    expect(user).toBeTruthy()
    expect(user?.email).toBe('teacher@school.edu')

    expect(await countAuthTableRows(db, 'user')).toBe(1)
    expect(await countAccountRowsForUser(db, user!.id)).toBe(1)
  }, 30_000)

  it('sign-in sets a session cookie', async () => {
    const { auth, env } = await openContext()

    await signUpEmail(auth, env, {
      email: 'existing@school.edu',
      password: DEV_AUTH_PASSWORD,
      name: 'Existing User',
    })

    const signInResponse = await signInEmail(auth, env, {
      email: 'existing@school.edu',
      password: DEV_AUTH_PASSWORD,
    })

    expect(signInResponse.status).toBe(200)
    expect(collectSetCookieHeaders(signInResponse).length).toBeGreaterThan(0)
  }, 30_000)

  it('resolves a linked staff actor from the session cookie', async () => {
    const { db, application, auth, env } = await openContext()

    await seedMinimalSchoolFixtures(application)
    const subjectId = await ensureAuthUser(auth, env, db, {
      email: MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
      password: DEV_AUTH_PASSWORD,
      name: 'Camille Moreau',
    })
    await linkStaffMemberToAuthUser(application, MINIMAL_AUTH_FIXTURE_STAFF_ID, subjectId)

    const signInResponse = await signInEmail(auth, env, {
      email: MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
      password: DEV_AUTH_PASSWORD,
    })

    const cookies = collectSetCookieHeaders(signInResponse)
    const staff = await application.repositories.staffMembers.findById(MINIMAL_AUTH_FIXTURE_STAFF_ID)

    const app = createSessionActorApp(application, auth)
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
  }, 30_000)

  it('returns 401 on a protected route when subjectId is not linked', async () => {
    const { application, auth, env } = await openContext()

    await seedMinimalSchoolFixtures(application)

    const signUpResponse = await signUpEmail(auth, env, {
      email: 'unlinked@school.edu',
      password: DEV_AUTH_PASSWORD,
      name: 'Unlinked User',
    })
    const cookies = collectSetCookieHeaders(signUpResponse)

    const app = createSessionActorApp(application, auth)
    mountEffectiveGrantsRoute(app)

    const response = await app.request('/core/authorization/effective-grants', {
      headers: {
        cookie: cookies.join('; '),
      },
    })

    expect(response.status).toBe(401)
  }, 30_000)

  it('returns 401 on a protected route when subjectId is ambiguous', async () => {
    const { db, application, auth, env } = await openContext()

    await seedMinimalSchoolFixtures(application)

    const signUpResponse = await signUpEmail(auth, env, {
      email: 'ambiguous@school.edu',
      password: DEV_AUTH_PASSWORD,
      name: 'Ambiguous User',
    })
    const cookies = collectSetCookieHeaders(signUpResponse)

    const user = await findUserByEmail(db, 'ambiguous@school.edu')
    expect(user).toBeTruthy()

    const staff = await application.repositories.staffMembers.findById(MINIMAL_AUTH_FIXTURE_STAFF_ID)
    const guardian = await application.repositories.guardians.findById(MINIMAL_AUTH_FIXTURE_GUARDIAN_ID)
    expect(staff).toBeTruthy()
    expect(guardian).toBeTruthy()

    await application.repositories.staffMembers.save(new StaffMember({
      id: staff!.id,
      schoolId: staff!.schoolId,
      firstName: staff!.firstName,
      lastName: staff!.lastName,
      email: staff!.email,
      isActive: staff!.isActive,
      createdAt: staff!.createdAt,
      subjectId: user!.id,
    }))
    await application.repositories.guardians.save(new Guardian({
      id: guardian!.id,
      schoolId: guardian!.schoolId,
      firstName: guardian!.firstName,
      lastName: guardian!.lastName,
      email: guardian!.email,
      phone: guardian!.phone,
      createdAt: guardian!.createdAt,
      subjectId: user!.id,
    }))

    const app = createSessionActorApp(application, auth)
    mountEffectiveGrantsRoute(app)

    const response = await app.request('/core/authorization/effective-grants', {
      headers: {
        cookie: cookies.join('; '),
      },
    })

    expect(response.status).toBe(401)
  }, 30_000)
})
