import { describe, expect, test } from 'bun:test'
import {
  AuthorizationError,
  checkModuleAccess,
  createGuardianActorMetadata,
  createStaffActorMetadata,
  createStudentActorMetadata,
  createSystemActorMetadata,
} from '../../../src/authorization'
import type { SchoolRepositories } from '../../../src/ports'

const repos = {} as SchoolRepositories
const now = new Date('2026-01-01T00:00:00Z')

const studentActor = createStudentActorMetadata({
  subjectId: 'student-subject',
  studentId: 'student-1',
  schoolId: 'school-1',
  requestId: 'request-1',
  authenticatedAt: now,
})

const guardianActor = createGuardianActorMetadata({
  subjectId: 'guardian-subject',
  guardianId: 'guardian-1',
  schoolId: 'school-1',
  requestId: 'request-1',
  authenticatedAt: now,
})

const staffActor = createStaffActorMetadata({
  subjectId: 'staff-subject',
  staffMemberId: 'staff-1',
  schoolId: 'school-1',
  requestId: 'request-1',
  authenticatedAt: now,
  effectiveGrants: {
    permissions: new Set(),
    scopeGrants: [],
    isElevated: false,
  },
})

describe('checkModuleAccess', () => {
  test('allows system actors regardless of school boundary', async () => {
    await expect(checkModuleAccess(
      createSystemActorMetadata({
        systemId: 'bootstrap',
        schoolId: 'school-other',
        requestId: 'request-1',
        reason: 'setup',
      }),
      'school-1',
      'setup',
      repos,
    )).resolves.toBeUndefined()
  })

  test('allows portal actors for attendance, finance, academics, and assessments', async () => {
    await expect(checkModuleAccess(studentActor, 'school-1', 'attendance', repos)).resolves.toBeUndefined()
    await expect(checkModuleAccess(guardianActor, 'school-1', 'finance', repos)).resolves.toBeUndefined()
    await expect(checkModuleAccess(studentActor, 'school-1', 'academics', repos)).resolves.toBeUndefined()
    await expect(checkModuleAccess(studentActor, 'school-1', 'assessments', repos)).resolves.toBeUndefined()
  })

  test('rejects portal actors for staff-only modules', async () => {
    await expect(checkModuleAccess(studentActor, 'school-1', 'setup', repos)).rejects.toBeInstanceOf(AuthorizationError)
    await expect(checkModuleAccess(guardianActor, 'school-1', 'students', repos)).rejects.toBeInstanceOf(AuthorizationError)
    await expect(checkModuleAccess(studentActor, 'school-1', 'communications', repos)).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('rejects cross-school access before module rules', async () => {
    await expect(checkModuleAccess(studentActor, 'school-other', 'attendance', repos)).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('requires staff actors to carry preloaded grants', async () => {
    await expect(checkModuleAccess(staffActor, 'school-1', 'setup', repos)).rejects.toBeInstanceOf(AuthorizationError)
  })
})
