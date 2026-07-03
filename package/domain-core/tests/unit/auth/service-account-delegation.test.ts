import { describe, expect, test } from 'bun:test'
import {
  assertDelegatedPermissionAssignmentsSubset,
  assertDelegatedPermissionsSubset,
  assertDelegatedScopeGrantsSubset,
  assertOwnerServiceAccountAllowed,
  AuthorizationError,
  delegatedPermissionAssignmentSubsetCovers,
  Permission,
  scopeGrantSubsetCovers,
} from '../../../src/capabilities/authorization'
import { effectiveGrantsForRoles } from '../../support/effective-grants'

describe('service account delegation', () => {
  test('allows delegated permissions that creator holds', () => {
    const creator = effectiveGrantsForRoles(['teacher'])

    expect(() => assertDelegatedPermissionsSubset(
      creator,
      [Permission.GRADE_INPUT, Permission.ATTENDANCE_RECORD],
    )).not.toThrow()
  })

  test('rejects delegated permissions creator does not hold', () => {
    const creator = effectiveGrantsForRoles(['teacher'])

    expect(() => assertDelegatedPermissionsSubset(
      creator,
      [Permission.PAYMENT_RECORD],
    )).toThrow(AuthorizationError)
  })

  test('elevated creator can delegate any permission except platform register', () => {
    const creator = effectiveGrantsForRoles(['admin'])

    expect(() => assertDelegatedPermissionsSubset(
      creator,
      [Permission.PAYMENT_RECORD, Permission.STUDENT_CREATE],
    )).not.toThrow()

    expect(() => assertDelegatedPermissionsSubset(
      creator,
      [Permission.PLATFORM_REGISTER_SCHOOL],
    )).toThrow(AuthorizationError)
  })

  test('scope grants must be subset of creator grants', () => {
    const creator = effectiveGrantsForRoles(['teacher'])

    expect(scopeGrantSubsetCovers(creator, {
      permission: Permission.GRADE_INPUT,
      scopeType: 'class_group',
      scopeEntityIds: ['class-1'],
    }, 'school-1')).toBe(true)

    expect(scopeGrantSubsetCovers(creator, {
      permission: Permission.GRADE_INPUT,
      scopeType: 'class_group',
      scopeEntityIds: ['unknown-class'],
    }, 'school-1')).toBe(false)
  })

  test('rejects scope grants outside creator coverage', () => {
    const creator = effectiveGrantsForRoles(['teacher'])

    expect(() => assertDelegatedScopeGrantsSubset(creator, [{
      permission: Permission.GRADE_INPUT,
      scopeType: 'class_group',
      scopeEntityIds: ['unknown-class'],
    }], 'school-1')).toThrow(AuthorizationError)
  })

  test('permission assignments must be subset of creator grants', () => {
    const creator = effectiveGrantsForRoles(['teacher'])

    expect(delegatedPermissionAssignmentSubsetCovers(creator, {
      permission: Permission.GRADE_INPUT,
      scopeIds: 'class-math',
    }, 'school-1')).toBe(true)

    expect(delegatedPermissionAssignmentSubsetCovers(creator, {
      permission: Permission.PAYMENT_RECORD,
      scopeIds: '',
    }, 'school-1')).toBe(false)
  })

  test('rejects permission assignments outside creator coverage', () => {
    const creator = effectiveGrantsForRoles(['teacher'])

    expect(() => assertDelegatedPermissionAssignmentsSubset(creator, [{
      permission: Permission.PAYMENT_RECORD,
      scopeIds: '',
    }], 'school-1')).toThrow(AuthorizationError)
  })

  test('only elevated creators can provision owner-level service accounts', () => {
    expect(() => assertOwnerServiceAccountAllowed(
      effectiveGrantsForRoles(['admin']),
      true,
    )).not.toThrow()

    expect(() => assertOwnerServiceAccountAllowed(
      effectiveGrantsForRoles(['teacher']),
      true,
    )).toThrow(AuthorizationError)

    expect(() => assertOwnerServiceAccountAllowed(
      effectiveGrantsForRoles(['teacher']),
      false,
    )).not.toThrow()
  })
})
