import { DomainValidationError, Permission, StaffPermissionProfile } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

describe('StaffPermissionProfile', () => {
  test('accepts mixed-scope permissions', () => {
    const profile = new StaffPermissionProfile({
      id: 'profile',
      schoolId: 'school',
      name: 'Mixed',
      permissions: [Permission.PAYMENT_READ, Permission.GRADE_MANAGE],
    })
    expect(profile.permissions).toEqual([Permission.PAYMENT_READ, Permission.GRADE_MANAGE])
  })

  test('accepts school permissions', () => {
    const profile = new StaffPermissionProfile({
      id: 'profile',
      schoolId: 'school',
      name: 'Finance',
      permissions: [Permission.PAYMENT_READ, Permission.ACCESS_CONTROL_READ],
    })
    expect(profile.permissions).toEqual([Permission.PAYMENT_READ, Permission.ACCESS_CONTROL_READ])
  })

  test('rejects platform permissions', () => {
    expect(() => new StaffPermissionProfile({
      id: 'profile',
      schoolId: 'school',
      name: 'Platform',
      permissions: [Permission.PLATFORM_USER_READ],
    })).toThrow(DomainValidationError)
  })
})
