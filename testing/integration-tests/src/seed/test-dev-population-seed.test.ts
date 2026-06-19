import {
  countSeedGuardians,
  countSeedStudents,
  DEV_AUTH_PASSWORD,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  SEED_CLASS_STUDENT_IDS,
  SEED_TARGET_STUDENT_COUNT,
} from '@edaya/dev-fixtures'
import { createHandlerAuthProvisioner, runDevAccessSeed, runDevAuthLink, runDevSchoolSeed } from '@edaya/seeding'
import { afterEach, describe, expect, it } from 'bun:test'
import { resetApiRuntimesForTests } from '@/runtime'
import { apiPgliteEnv } from '../support/api-pglite-env'

import {
  collectSetCookieHeaders,
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

describe('dev population seed', () => {
  afterEach(async () => {
    await resetApiRuntimesForTests()
  })

  it('seeds 30 students and 21 guardians with class distribution and staff assignments', async () => {
    const { app, runtime, application } = await createCoreRouteTestApp()
    const seedResult = await runDevSchoolSeed(application)
    expect(seedResult.status).toBe('seeded')
    if (seedResult.status === 'seeded') {
      expect(seedResult.students).toBe(SEED_TARGET_STUDENT_COUNT)
      expect(seedResult.students).toBe(countSeedStudents())
      expect(seedResult.guardians).toBe(countSeedGuardians())
    }

    await runDevAuthLink(application, createHandlerAuthProvisioner(runtime.getAuth(), apiPgliteEnv.BETTER_AUTH_URL))
    const accessResult = await runDevAccessSeed(application)
    expect(accessResult.status).toBe('seeded')

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

    const [studentsResponse, guardiansResponse, enrollmentsResponse, staffAssignmentsResponse] = await Promise.all([
      app.request(createAppRequest('/core/entities/students/list', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/guardians/list', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/enrollments/list', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/staff-assignments/list', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({}),
      })),
    ])

    expect(studentsResponse.status).toBe(200)
    expect(guardiansResponse.status).toBe(200)
    expect(enrollmentsResponse.status).toBe(200)
    expect(staffAssignmentsResponse.status).toBe(200)

    const students = unwrapEntityList<{ id: string }>(await studentsResponse.json())
    const guardians = unwrapEntityList<{ id: string }>(await guardiansResponse.json())
    const enrollments = unwrapEntityList<{ studentId: string, classGroupId: string }>(await enrollmentsResponse.json())
    const staffAssignments = unwrapEntityList<{ id: string, classGroupId?: string, responsibility?: string }>(
      await staffAssignmentsResponse.json(),
    )

    expect(students.length).toBe(SEED_TARGET_STUDENT_COUNT)
    expect(guardians.length).toBeGreaterThanOrEqual(countSeedGuardians())
    expect(enrollments.length).toBe(SEED_TARGET_STUDENT_COUNT)
    expect(students.some(student => student.id === 's30')).toBe(true)
    expect(guardians.some(guardian => guardian.id === 'g9')).toBe(true)

    for (const [classGroupId, studentIds] of Object.entries(SEED_CLASS_STUDENT_IDS)) {
      for (const studentId of studentIds) {
        expect(enrollments.some(enrollment => enrollment.studentId === studentId && enrollment.classGroupId === classGroupId)).toBe(true)
      }
    }

    expect(staffAssignments.some(assignment => assignment.id === 'sa-st2-6b' && assignment.classGroupId === '6b')).toBe(true)
    expect(staffAssignments.some(assignment => assignment.id === 'sa-st3-5a' && assignment.classGroupId === '5a')).toBe(true)
  }, 30_000)
})
