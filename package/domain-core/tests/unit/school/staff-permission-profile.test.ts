import { DomainValidationError, Permission, StaffPermissionProfile } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

describe('StaffPermissionProfile', () => {
  test('rejects mixed-grain permissions', () => {
    expect(() => new StaffPermissionProfile({
      id: 'profile',
      schoolId: 'school',
      name: 'Mixed',
      scopeGrain: 'school',
      permissions: [Permission.PAYMENT_READ, Permission.GRADE_INPUT],
    })).toThrow(DomainValidationError)
  })

  test('accepts same-grain school permissions', () => {
    const profile = new StaffPermissionProfile({
      id: 'profile',
      schoolId: 'school',
      name: 'Finance',
      scopeGrain: 'school',
      permissions: [Permission.PAYMENT_READ, Permission.ACCESS_CONTROL_READ],
    })
    expect(profile.permissions).toEqual([Permission.PAYMENT_READ, Permission.ACCESS_CONTROL_READ])
  })

  test('rejects platform permissions', () => {
    expect(() => new StaffPermissionProfile({
      id: 'profile',
      schoolId: 'school',
      name: 'Platform',
      scopeGrain: 'school',
      permissions: [Permission.PLATFORM_USER_READ],
    })).toThrow(DomainValidationError)
  })
})
