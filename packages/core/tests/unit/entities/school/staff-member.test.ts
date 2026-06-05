import { describe, expect, test } from 'bun:test'
import { StaffMember } from '../../../../src/entities/school/staff-member'

describe('StaffMember entity', () => {
  const baseArgs = {
    id: 'staff1',
    schoolId: 'sch1',
    firstName: 'Jane',
    lastName: 'Doe',
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
    expect(staff.email).toBe('jane@example.com')
    expect(staff.isActive).toBe(false)
    expect(staff.createdAt).toBeInstanceOf(Date)
  })

  test('defaults staff to active', () => {
    const staff = new StaffMember({
      ...baseArgs,
    })
    expect(staff.isActive).toBe(true)
  })

  test('throws error if required text fields are blank', () => {
    expect(() => {
      new StaffMember({ ...baseArgs, firstName: '' })
    }).toThrow('firstName')
  })
})
