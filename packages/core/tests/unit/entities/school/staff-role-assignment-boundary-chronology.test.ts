import { describe, expect, it } from 'bun:test'
import { Permission } from '../../../../src/authorization'
import { StaffRoleAssignment } from '../../../../src/domains/school/staff-role-assignment'
import { DomainValidationError } from '../../../../src/domains/utils'

describe('StaffRoleAssignment boundary and chronology validation', () => {
  const baseArgs = {
    id: 'assignment-1',
    staffId: 'staff-1',
    schoolId: 'school-1',
    roleIds: ['role-1'],
  }

  it('instantiates successfully with valid inputs and defaults', () => {
    const assignment = new StaffRoleAssignment(baseArgs)

    expect(assignment.id).toBe('assignment-1')
    expect(assignment.staffId).toBe('staff-1')
    expect(assignment.schoolId).toBe('school-1')
    expect(assignment.roleIds).toEqual(['role-1'])
    expect(assignment.scopeGrants).toEqual([])
    expect(assignment.status).toBe('active')
    expect(assignment.startsAt).toBeUndefined()
    expect(assignment.endsAt).toBeUndefined()
    expect(assignment.createdAt).toBeInstanceOf(Date)
    expect(assignment.updatedAt).toEqual(assignment.createdAt)
  })

  it('deduplicates roleIds and freezes arrays', () => {
    const assignment = new StaffRoleAssignment({
      ...baseArgs,
      roleIds: ['role-1', 'role-2', 'role-1'],
      scopeGrants: [
        {
          permission: Permission.RESOURCE_READ,
          scopeType: 'school',
          scopeEntityIds: ['school-1'],
        },
      ],
    })

    expect(assignment.roleIds).toEqual(['role-1', 'role-2'])
    expect(Object.isFrozen(assignment.roleIds)).toBe(true)
    expect(Object.isFrozen(assignment.scopeGrants)).toBe(true)
    expect(Object.isFrozen(assignment.scopeGrants[0]!.scopeEntityIds)).toBe(true)
  })

  it('throws DomainValidationError when roleIds is empty', () => {
    expect(() => {
      new StaffRoleAssignment({
        ...baseArgs,
        roleIds: [],
      })
    }).toThrow('roleIds must contain at least one role')
  })

  it('throws DomainValidationError when status is invalid', () => {
    expect(() => {
      new StaffRoleAssignment({
        ...baseArgs,
        status: 'invalid-status' as any,
      })
    }).toThrow(DomainValidationError)
  })

  it('throws DomainValidationError when endsAt is before startsAt', () => {
    expect(() => {
      new StaffRoleAssignment({
        ...baseArgs,
        startsAt: new Date('2026-06-09'),
        endsAt: new Date('2026-06-08'),
      })
    }).toThrow('endsAt must not be before startsAt')
  })

  it('instantiates successfully when endsAt is after or equal to startsAt', () => {
    const startsAt = new Date('2026-06-09')
    const endsAt = new Date('2026-06-09')
    const assignment = new StaffRoleAssignment({
      ...baseArgs,
      startsAt,
      endsAt,
    })
    expect(assignment.startsAt?.getTime()).toBe(startsAt.getTime())
    expect(assignment.endsAt?.getTime()).toBe(endsAt.getTime())
  })
})
