import type { IdentityClient } from '@maya-invest/edaya-identity-client'
import type { AppBindings } from '@/http/types'
import { AccessPolicies, createStaffActorMetadata } from '@edaya/authorization'
import { AcademicYear, Permission, School, StaffPermissionAssignment } from '@edaya/core'
import { createDirectoryClient } from '@maya-invest/edaya-identity-client'
import { expect, test } from 'bun:test'
import { Hono } from 'hono'
import { createSessionActorDependency } from '@/http/dependencies/session-actor'
import { createDependenciesInjection } from '@/http/dependency-injection'
import { describeIntegration } from '../support/suite-runner'
import { createTestApp } from '../utils/test-adapter'

describeIntegration('production session actor', () => {
  async function fixture(emailVerified = true, subjectId = 'admin-user') {
    const { schoolRepositories: repos } = await createTestApp(createStaffActorMetadata({ schoolId: 'school', staffMemberId: 'admin', subjectId: 'admin-user', requestId: 'test', authenticatedAt: new Date() }))
    await repos.schools.save(new School({ id: 'school', name: 'School', timeZone: 'UTC' }))
    for (const [id, schoolId] of [['selected', 'school'], ['other', 'school'], ['foreign', 'elsewhere']] as const) {
      await repos.academicYears.save(new AcademicYear({ id, schoolId, name: id, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), status: 'published' }))
    }
    await repos.staffPermissionAssignments.save(new StaffPermissionAssignment({
      id: 'selected-grant',
      staffId: 'admin',
      schoolId: 'school',
      academicYearId: 'selected',
      permission: Permission.GRADE_READ,
      scopes: [{ kind: 'all', grain: 'class_group' }],
    }))
    const identityClient: IdentityClient = {
      directory: createDirectoryClient({ baseUrl: 'https://identity.invalid', secret: 'test', fetch: Object.assign(async () => new Response(null, { status: 404 }), { preconnect: fetch.preconnect }) }),
      verifyAccessToken: async () => ({ sub: subjectId, email: 'operator@example.invalid', email_verified: emailVerified, iss: 'https://identity.invalid', aud: 'school', exp: 9999999999, iat: 1 }),
    }
    const app = new Hono<AppBindings>()
    app.use(async (c, next) => {
      c.set('schoolApp', { repositories: repos } as AppBindings['Variables']['schoolApp'])
      await next()
    })
    app.use(createDependenciesInjection([createSessionActorDependency(() => identityClient)]))
    app.get('/', async (c) => {
      const actor = c.get('actor')
      let canReadGrades = false
      if (actor?.kind === 'staff') {
        try {
          await new AccessPolicies(actor, repos).grades.readScope()
          canReadGrades = true
        }
        catch { /* A year without grants must remain unauthorized. */ }
      }
      return c.json({ actor, canReadGrades })
    })
    return { app, repos }
  }

  test('uses the selected year for ordinary staff policy evaluation', async () => {
    const { app } = await fixture()
    for (const [year, allowed] of [['selected', true], ['other', false]] as const) {
      const response = await app.request('/', { headers: { 'authorization': 'Bearer test-jwt', 'x-actor-kind': 'staff', 'x-academic-year-id': year } })
      const body = await response.json() as { actor: { academicYearId: string }, canReadGrades: boolean }
      expect(body.actor.academicYearId).toBe(year)
      expect(body.canReadGrades).toBe(allowed)
    }
  })

  test('allows omitted context and rejects foreign or missing years', async () => {
    const { app } = await fixture()
    const response = await app.request('/', { headers: { 'authorization': 'Bearer test-jwt', 'x-actor-kind': 'staff' } })
    expect((await response.json() as { actor: { academicYearId?: string } }).actor.academicYearId).toBeUndefined()
    for (const year of ['foreign', 'missing']) {
      const denied = await app.request('/', { headers: { 'authorization': 'Bearer test-jwt', 'x-actor-kind': 'staff', 'x-academic-year-id': year } })
      expect((await denied.json() as { actor: unknown }).actor).toBeNull()
    }
  })

  test.each([false, true])('privileged bootstrap requires verified email: %s', async (verified) => {
    const { app, repos } = await fixture(verified, 'new-operator')
    const response = await app.request('/', { headers: { 'authorization': 'Bearer test-jwt', 'x-actor-kind': 'platform' } }, { PLATFORM_BOOTSTRAP_EMAILS: 'operator@example.invalid' } as AppBindings['Bindings'])
    const body = await response.json() as { actor: { kind: string } | null }
    const saved = await repos.platformUsers.findBySubjectId('new-operator')
    if (verified) {
      expect(body.actor?.kind).toBe('platform')
      expect(saved?.isActive).toBe(true)
    }
    else {
      expect(body.actor).toBeNull()
      expect(saved).toBeUndefined()
    }
  })
})
