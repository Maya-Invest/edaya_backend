import { describe, expect, test } from 'bun:test'
import { StaffMember, StaffRole } from '../../../../src/entities/school/staff-member'

describe('StaffMember entity', () => {
  const baseArgs = {
    id: 'staff1',
    schoolId: 'sch1',
    firstName: 'Jane',
    lastName: 'Doe',
    roles: [StaffRole.Teacher],
  }

  test('instantiates successfully with valid inputs', () => {
    const staff = new StaffMember({
      ...baseArgs,
      email: 'jane@example.com',
      isActive: false,
    })

    expect(staff.id).toBe('staff1')
    expect(staff.firstName).toBe('Jane')
    expect(staff.lastName).toBe('Doe')
    expect(staff.fullName).toBe('Jane Doe')
    expect(staff.roles).toEqual([StaffRole.Teacher])
    expect(staff.email).toBe('jane@example.com')
    expect(staff.isActive).toBe(false)
    expect(staff.createdAt).toBeInstanceOf(Date)
  })

  test('deduplicates roles', () => {
    const staff = new StaffMember({
      ...baseArgs,
      roles: [StaffRole.Teacher, StaffRole.Teacher, StaffRole.Admin],
    })
    expect(staff.roles).toEqual([StaffRole.Teacher, StaffRole.Admin])
  })

  test('hasRole returns correctly', () => {
    const staff = new StaffMember({
      ...baseArgs,
      roles: [StaffRole.Teacher],
    })
    expect(staff.hasRole(StaffRole.Teacher)).toBe(true)
    expect(staff.hasRole(StaffRole.Admin)).toBe(false)
  })

  test('throws error if roles array is empty', () => {
    expect(() => {
      new StaffMember({ ...baseArgs, roles: [] })
    }).toThrow('roles must contain at least one role')
  })
})
