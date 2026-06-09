import { describe, expect, test } from 'bun:test'
import {
  assertPortalPermission,
  AuthorizationError,
  authorize,
  createGuardianActorMetadata,
  createStudentActorMetadata,
  GUARDIAN_PORTAL_PERMISSIONS,
  Permission,
  portalPermissionPolicyFor,
  STUDENT_PORTAL_PERMISSIONS,
} from '../../../src/authorization'

const now = new Date('2026-01-01T00:00:00Z')

const guardianActor = createGuardianActorMetadata({
  subjectId: 'guardian-subject',
  guardianId: 'guardian-1',
  schoolId: 'school-1',
  requestId: 'request-1',
  authenticatedAt: now,
})

const studentActor = createStudentActorMetadata({
  subjectId: 'student-subject',
  studentId: 'student-1',
  schoolId: 'school-1',
  requestId: 'request-1',
  authenticatedAt: now,
})

describe('portal permission policy', () => {
  test('keeps guardian and student portal policies explicit and independent', () => {
    expect(portalPermissionPolicyFor('guardian').permissions).toBe(GUARDIAN_PORTAL_PERMISSIONS)
    expect(portalPermissionPolicyFor('student').permissions).toBe(STUDENT_PORTAL_PERMISSIONS)
    expect(GUARDIAN_PORTAL_PERMISSIONS).not.toBe(STUDENT_PORTAL_PERMISSIONS)
  })

  test('allows portal read permissions and rejects staff write permissions', () => {
    expect(() => assertPortalPermission(guardianActor, Permission.QUERY_STUDENT_DETAIL_READ)).not.toThrow()
    expect(() => assertPortalPermission(studentActor, Permission.QUERY_STUDENT_DETAIL_READ)).not.toThrow()

    expect(() => assertPortalPermission(guardianActor, Permission.STUDENT_UPDATE))
      .toThrow(AuthorizationError)
    expect(() => assertPortalPermission(studentActor, Permission.PAYMENT_RECORD))
      .toThrow(AuthorizationError)
  })

  test('authorize applies portal policy synchronously', () => {
    expect(authorize({
      actor: guardianActor,
      request: {
        actorId: guardianActor.guardianId,
        schoolId: 'school-1',
        permission: Permission.QUERY_STUDENT_DETAIL_READ,
      },
    })).toBeUndefined()
  })
})
