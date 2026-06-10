import type { AuthorizationPolicy } from '../../../src/authorization'
import type { TestRole } from '../../support/effective-grants'
import { describe, expect, test } from 'bun:test'
import {
  AuthorizationError,

  authorize,
  createStaffActorMetadata,
  Permission,
  permissionDefinitions,
} from '../../../src/authorization'
import { anyPermissionAction, permissionAction } from '../../../src/shared'
import { effectiveGrantsForRoles } from '../../support/effective-grants'

function noopPolicy(): AuthorizationPolicy {
  return {
    checkStudentAccess: async () => {},
    checkGuardianAccess: async () => {},
    checkStudentNoteAccess: async () => {},
    checkStudentHealthAccess: async () => {},
    checkClassGroupAccess: async () => {},
    checkAssessmentAccess: async () => {},
    checkReportCardResultAccess: async () => {},
    checkFeeAccess: async () => {},
    checkStudentFeeAccess: async () => {},
    checkSessionAccess: async () => {},
    checkAttendanceAccess: async () => {},
    checkModuleAccess: async () => {},
  }
}

const now = new Date('2026-01-01T00:00:00Z')

function staffActor(roles: TestRole[]) {
  return createStaffActorMetadata({
    subjectId: 'subject-staff',
    staffMemberId: 'staff-1',
    schoolId: 'school-1',
    requestId: 'request-1',
    authenticatedAt: now,
    effectiveGrants: effectiveGrantsForRoles(roles),
  })
}

describe('permission catalog', () => {
  test('defines metadata for every permission', () => {
    for (const permission of Object.values(Permission)) {
      expect(permissionDefinitions[permission].permission).toBe(permission)
      expect(permissionDefinitions[permission].allowedScopes.length).toBeGreaterThan(0)
    }
  })
})

describe('authorize', () => {
  test('allows teachers to record attendance through effective grants', () => {
    const actor = staffActor(['teacher'])

    expect(authorize({
      actor,
      request: {
        schoolId: 'school-1',
        permission: Permission.ATTENDANCE_RECORD,
      },
    })).toBeUndefined()
  })

  test('rejects teachers for finance permissions', () => {
    const actor = staffActor(['teacher'])

    expect(() => authorize({
      actor,
      request: {
        schoolId: 'school-1',
        permission: Permission.PAYMENT_RECORD,
      },
    })).toThrow(AuthorizationError)
  })

  test('rejects scope types not allowed for the permission', () => {
    const actor = staffActor(['admin'])

    expect(() => authorize({
      actor,
      request: {
        schoolId: 'school-1',
        permission: Permission.PAYMENT_RECORD,
        scopeType: 'class_group',
        scopeEntityId: 'class-1',
      },
    })).toThrow(AuthorizationError)
  })

  test('rejects school mismatch', () => {
    const actor = staffActor(['admin'])

    expect(() => authorize({
      actor,
      request: {
        schoolId: 'school-other',
        permission: Permission.ATTENDANCE_READ,
      },
    })).toThrow(AuthorizationError)
  })

  test('rejects staff authorization with empty preloaded grants', () => {
    const actor = createStaffActorMetadata({
      subjectId: 'subject-staff',
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      effectiveGrants: {
        permissions: new Set(),
        scopeGrants: [],
        isElevated: false,
      },
      requestId: 'request-1',
      authenticatedAt: now,
    })

    expect(() => authorize({
      actor,
      request: {
        schoolId: 'school-1',
        permission: Permission.STAFF_READ,
      },
    })).toThrow(AuthorizationError)
  })

  test('permissionAction uses preloaded grants', async () => {
    const policy = noopPolicy()
    const actor = createStaffActorMetadata({
      subjectId: 'subject-staff',
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      requestId: 'request-1',
      authenticatedAt: now,
      effectiveGrants: {
        permissions: new Set([Permission.ATTENDANCE_RECORD]),
        scopeGrants: [{
          permission: Permission.ATTENDANCE_RECORD,
          scopeType: 'school',
          scopeEntityIds: ['school-1'],
        }],
        isElevated: false,
      },
    })

    await expect(permissionAction(policy, Permission.ATTENDANCE_RECORD, {
      scopeType: 'school',
      scopeEntityId: 'school-1',
    })(actor)).resolves.toBeUndefined()
  })

  test('anyPermissionAction allows one matching permission gate', async () => {
    const policy = noopPolicy()
    const actor = createStaffActorMetadata({
      subjectId: 'subject-staff',
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      requestId: 'request-1',
      authenticatedAt: now,
      effectiveGrants: {
        permissions: new Set([Permission.PAYMENT_READ]),
        scopeGrants: [{
          permission: Permission.PAYMENT_READ,
          scopeType: 'school',
          scopeEntityIds: ['school-1'],
        }],
        isElevated: false,
      },
    })

    await expect(anyPermissionAction(policy, [
      Permission.PAYMENT_RECORD,
      Permission.PAYMENT_READ,
    ])(actor)).resolves.toBeUndefined()
  })
})
