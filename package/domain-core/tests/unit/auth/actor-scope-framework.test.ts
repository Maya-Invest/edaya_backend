import { describe, expect, test } from 'bun:test'
import {
  ALL_GUARDIAN_CAPABILITIES,
  ALL_STUDENT_CAPABILITIES,
  assertCapability,
  AuthorizationError,
  createGuardianActorMetadata,
  createStaffActorMetadata,
  createTeacherActorMetadata,
  effectiveGrantsForActor,
  EMPTY_TEACHER_SCOPE,
} from '../../../src/capabilities/authorization'
import { effectiveGrantsForRoles, portalScopeForGuardian } from '../../support/effective-grants'

const now = new Date('2026-01-01T00:00:00Z')

describe('actor scope framework', () => {
  test('portal actors no longer carry synthesized permission grants', () => {
    const guardian = createGuardianActorMetadata({
      subjectId: 'guardian-subject',
      guardianId: 'guardian-1',
      schoolId: 'school-1',
      requestId: 'request-1',
      authenticatedAt: now,
      guardianScope: portalScopeForGuardian(['student-1']),
    })

    expect(effectiveGrantsForActor(guardian).permissions.size).toBe(0)
    expect(ALL_GUARDIAN_CAPABILITIES.length).toBeGreaterThan(0)
  })

  test('portal actors expose empty permission grants after Fold D', () => {
    const teacher = createTeacherActorMetadata({
      subjectId: 'teacher-subject',
      teacherId: 'teacher-1',
      schoolId: 'school-1',
      requestId: 'request-1',
      authenticatedAt: now,
      teacherScope: EMPTY_TEACHER_SCOPE,
    })

    expect(effectiveGrantsForActor(teacher).permissions.size).toBe(0)
  })

  test('assertCapability rejects staff and routes guardian capabilities', () => {
    const staff = createStaffActorMetadata({
      subjectId: 'staff-subject',
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      requestId: 'request-1',
      authenticatedAt: now,
      effectiveGrants: effectiveGrantsForRoles(['admin']),
    })

    expect(() => assertCapability(staff, 'ReadGrades')).toThrow(AuthorizationError)

    const guardian = createGuardianActorMetadata({
      subjectId: 'guardian-subject',
      guardianId: 'guardian-1',
      schoolId: 'school-1',
      requestId: 'request-1',
      authenticatedAt: now,
      guardianScope: portalScopeForGuardian(['student-1']),
    })

    expect(() => assertCapability(guardian, 'ReadGrades', { studentId: 'student-1' })).not.toThrow()
    expect(ALL_STUDENT_CAPABILITIES.length).toBeGreaterThan(0)
  })
})
