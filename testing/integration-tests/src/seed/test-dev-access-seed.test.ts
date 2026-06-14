import {
  DEV_AUTH_PASSWORD,
  DEV_AUTH_STAFF_ACCOUNTS,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  MINIMAL_AUTH_FIXTURE_STAFF_ID,
  SEED_STAFF,
} from '@edaya/dev-fixtures'
import { createHandlerAuthProvisioner, runDevAccessSeed, runDevAuthLink, runDevSchoolSeed } from '@edaya/seeding'
import { afterEach, describe, expect, it } from 'bun:test'
import { resetApiRuntimesForTests } from '@/lib/runtime/registry'
import { apiPgliteEnv } from '../support/api-pglite-env'
import {
  collectSetCookieHeaders,
  createAppRequest,
  createCoreRouteTestApp,
} from '../support/api-route-harness'

describe('dev access seed', () => {
  afterEach(async () => {
    await resetApiRuntimesForTests()
  })

  it('lets seeded teachers list students after access roles are provisioned', async () => {
    const { app, runtime, application } = await createCoreRouteTestApp()
    await runDevSchoolSeed(application)
    await runDevAuthLink(application, createHandlerAuthProvisioner(runtime.getAuth(), apiPgliteEnv.BETTER_AUTH_URL))
    await runDevAccessSeed(application)

    const signIn = await app.request(createAppRequest('/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: DEV_AUTH_STAFF_ACCOUNTS[1].email, password: DEV_AUTH_PASSWORD }),
    }))
    const cookies = collectSetCookieHeaders(signIn)

    const response = await app.request(createAppRequest('/core/entities/students/list', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'cookie': cookies.join('; '),
      },
      body: JSON.stringify({}),
    }))

    expect(response.status).toBe(200)
  }, 30_000)

  it('lets seeded teachers list guardians and class subjects for migrated webapp slices', async () => {
    const { app, runtime, application } = await createCoreRouteTestApp()
    await runDevSchoolSeed(application)
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

    const guardians = await app.request(createAppRequest('/core/entities/guardians/list', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    }))
    const classSubjects = await app.request(createAppRequest('/core/entities/class-subjects/list', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    }))

    expect(guardians.status).toBe(200)
    expect(classSubjects.status).toBe(200)

    const guardianBody = await guardians.json() as unknown[]
    const classSubjectBody = await classSubjects.json() as unknown[]
    expect(guardianBody.length).toBeGreaterThanOrEqual(6)
    expect(classSubjectBody.length).toBeGreaterThanOrEqual(8)
  }, 30_000)

  it('seeds all staff members and lets the director list them', async () => {
    const { app, runtime, application } = await createCoreRouteTestApp()
    await runDevSchoolSeed(application)
    await runDevAuthLink(application, createHandlerAuthProvisioner(runtime.getAuth(), apiPgliteEnv.BETTER_AUTH_URL))
    await runDevAccessSeed(application)

    const staffMembers = await application.repositories.staffMembers.list({})
    const directorAssignments = await application.repositories.staffRoleAssignments.list({
      staffId: MINIMAL_AUTH_FIXTURE_STAFF_ID,
      status: 'active',
    })
    expect(staffMembers.length).toBe(SEED_STAFF.length)
    expect(directorAssignments.some(entry => entry.roleIds.includes('role-director'))).toBe(true)

    const signIn = await app.request(createAppRequest('/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: MINIMAL_AUTH_FIXTURE_STAFF_EMAIL, password: DEV_AUTH_PASSWORD }),
    }))
    const cookies = collectSetCookieHeaders(signIn)
    const authHeaders = {
      'content-type': 'application/json',
      'cookie': cookies.join('; '),
    }

    const staffCount = await app.request(createAppRequest('/core/entities/staff-members/count', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    }))

    expect(staffCount.status).toBe(200)
    const countBody = await staffCount.json() as { count: number }
    expect(countBody.count).toBe(SEED_STAFF.length)
  }, 30_000)

  it('seeds access roles and lets the director list them', async () => {
    const { app, runtime, application } = await createCoreRouteTestApp()
    await runDevSchoolSeed(application)
    await runDevAuthLink(application, createHandlerAuthProvisioner(runtime.getAuth(), apiPgliteEnv.BETTER_AUTH_URL))
    await runDevAccessSeed(application)

    const accessRoles = await application.repositories.accessRoles.list({})
    expect(accessRoles.length).toBe(4)
    expect(accessRoles.some(role => role.id === 'role-director')).toBe(true)
    expect(accessRoles.some(role => role.id === 'role-teacher')).toBe(true)

    const signIn = await app.request(createAppRequest('/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: MINIMAL_AUTH_FIXTURE_STAFF_EMAIL, password: DEV_AUTH_PASSWORD }),
    }))
    const cookies = collectSetCookieHeaders(signIn)

    const response = await app.request(createAppRequest('/core/entities/access-roles/list', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'cookie': cookies.join('; '),
      },
      body: JSON.stringify({}),
    }))

    expect(response.status).toBe(200)
    const body = await response.json() as unknown[]
    expect(body.length).toBeGreaterThanOrEqual(4)
  }, 30_000)
})
