import { describe, expect, test } from 'bun:test'
import {
  AuthorizationError,
  authorize,
  createGuardianActorMetadata,
  createStudentActorMetadata,
  GUARDIAN_PORTAL_PERMISSIONS,
  Permission,
  STUDENT_PORTAL_PERMISSIONS,
} from '../../../src/authorization'
import { portalEffectiveGrantsForGuardian, portalEffectiveGrantsForStudent } from '../../support/effective-grants'

const now = new Date('2026-01-01T00:00:00Z')

const guardianActor = createGuardianActorMetadata({
  subjectId: 'guardian-subject',
  guardianId: 'guardian-1',
  schoolId: 'school-1',
  requestId: 'request-1',
  authenticatedAt: now,
  effectiveGrants: portalEffectiveGrantsForGuardian(['student-1']),
})

const studentActor = createStudentActorMetadata({
  subjectId: 'student-subject',
  studentId: 'student-1',
  schoolId: 'school-1',
  requestId: 'request-1',
  authenticatedAt: now,
  effectiveGrants: portalEffectiveGrantsForStudent('student-1'),
})

describe('portal effective grants', () => {
  test('keeps guardian and student portal permission sets explicit and independent', () => {
    expect(GUARDIAN_PORTAL_PERMISSIONS).not.toBe(STUDENT_PORTAL_PERMISSIONS)
    expect(guardianActor.effectiveGrants.permissions).toBe(GUARDIAN_PORTAL_PERMISSIONS)
    expect(studentActor.effectiveGrants.permissions).toBe(STUDENT_PORTAL_PERMISSIONS)
  })

  test('authorize allows portal read permissions and rejects staff write permissions', () => {
    expect(() => authorize({
      actor: guardianActor,
      request: {
        schoolId: 'school-1',
        permission: Permission.QUERY_STUDENT_DETAIL_READ,
        scopeType: 'student',
        scopeEntityId: 'student-1',
      },
    })).not.toThrow()

    expect(() => authorize({
      actor: studentActor,
      request: {
        schoolId: 'school-1',
        permission: Permission.QUERY_STUDENT_DETAIL_READ,
        scopeType: 'student',
        scopeEntityId: 'student-1',
      },
    })).not.toThrow()

    expect(() => authorize({
      actor: guardianActor,
      request: {
        schoolId: 'school-1',
        permission: Permission.STUDENT_UPDATE,
      },
    })).toThrow(AuthorizationError)

    expect(() => authorize({
      actor: studentActor,
      request: {
        schoolId: 'school-1',
        permission: Permission.PAYMENT_RECORD,
      },
    })).toThrow(AuthorizationError)
  })
})
