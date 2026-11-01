import { AcademicYear, School, StaffMember, Student } from '@edaya/core'
import { MINIMAL_AUTH_FIXTURE_STAFF_EMAIL } from '@edaya/fixtures/meta/dev-auth-fixtures'
import { DEMO_CI_ACADEMIC_YEAR_ID, SEED_SCHOOL_ID } from '@edaya/fixtures/shared/ids'
import { afterEach, beforeEach, describe } from 'bun:test'
import { createCoreRouteTestApp, resetCoreRouteTestHarness, signInWithBearerThroughApp, testIdentityProvisioner } from './api-route-harness'

/** Focused HTTP contracts keep real SQL actor resolution without the demo population. */
export function describeWithMinimalSchool(
  name: string,
  suite: (getContext: () => Awaited<ReturnType<typeof createCoreRouteTestApp>> & { authHeaders: (email?: string) => Promise<Record<string, string>> }) => void,
  students: string[] = [],
): void {
  describe(name, () => {
    let context: Awaited<ReturnType<typeof createCoreRouteTestApp>>
    beforeEach(async () => {
      context = await createCoreRouteTestApp({ autoCleanup: false })
      const { subjectId } = await testIdentityProvisioner.ensureUser({ email: MINIMAL_AUTH_FIXTURE_STAFF_EMAIL, name: 'Route owner', password: 'disposable-route-password' })
      const repositories = context.application.repositories
      await repositories.schools.save(new School({ id: SEED_SCHOOL_ID, name: 'Route school', timeZone: 'UTC', ownerSubjectId: subjectId }))
      await repositories.academicYears.save(new AcademicYear({ id: DEMO_CI_ACADEMIC_YEAR_ID, schoolId: SEED_SCHOOL_ID, name: '2026-2027', startDate: new Date('2026-09-01'), endDate: new Date('2027-07-01'), status: 'published' }))
      await repositories.staffMembers.save(new StaffMember({ id: 'route-owner', schoolId: SEED_SCHOOL_ID, firstName: 'Route', lastName: 'Owner', subjectId }))
      for (const id of students)
        await repositories.students.save(new Student({ id, schoolId: SEED_SCHOOL_ID, firstName: 'Route', lastName: id }))
    })
    afterEach(async () => {
      try {
        await context?.runtime.close()
      }
      finally {
        await resetCoreRouteTestHarness()
      }
    })
    suite(() => ({ ...context, authHeaders: async (email = MINIMAL_AUTH_FIXTURE_STAFF_EMAIL) => ({
      'authorization': `Bearer ${await signInWithBearerThroughApp(context.app, { email })}`,
      'content-type': 'application/json',
      'x-academic-year-id': DEMO_CI_ACADEMIC_YEAR_ID,
    }) }))
  })
}
