import {
  Permission,
  resolveStaffGrantsFromPermissionAssignments,
} from '@edaya/authorization'
import { describe, expect, test } from 'bun:test'

describe('resolveStaffGrantsFromPermissionAssignments', () => {
  test('returns undefined when permission assignment repository is absent', async () => {
    await expect(resolveStaffGrantsFromPermissionAssignments({
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      academicYearId: 'year-1',
      repositories: {
        staffMembers: { findById: async () => ({ id: 'staff-1', schoolId: 'school-1', isActive: true }) },
      } as never,
    })).resolves.toBeUndefined()
  })

  test('returns undefined for inactive or mismatched staff members', async () => {
    const repositories = {
      staffMembers: {
        findById: async () => ({
          id: 'staff-1',
          schoolId: 'school-2',
          isActive: false,
          subjectId: 'subject-1',
        }),
      },
      staffPermissionAssignments: { list: async () => [] },
    }

    await expect(resolveStaffGrantsFromPermissionAssignments({
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      academicYearId: 'year-1',
      repositories: repositories as never,
    })).resolves.toBeUndefined()
  })

  test('returns elevated grants for elevated service accounts', async () => {
    const grants = await resolveStaffGrantsFromPermissionAssignments({
      staffMemberId: 'svc-1',
      schoolId: 'school-1',
      academicYearId: 'year-1',
      repositories: {
        staffMembers: {
          findById: async () => ({
            id: 'svc-1',
            schoolId: 'school-1',
            isActive: true,
            subjectId: 'subject-svc',
            accountKind: 'service',
            serviceElevated: true,
          }),
        },
        staffPermissionAssignments: { list: async () => [] },
      } as never,
    })

    expect(grants?.isElevated).toBe(true)
    expect(grants?.permissions.has(Permission.STUDENT_READ)).toBe(true)
  })

  test('returns elevated grants for school owners', async () => {
    const grants = await resolveStaffGrantsFromPermissionAssignments({
      staffMemberId: 'owner-1',
      schoolId: 'school-1',
      academicYearId: 'year-1',
      repositories: {
        staffMembers: {
          findById: async () => ({
            id: 'owner-1',
            schoolId: 'school-1',
            isActive: true,
            subjectId: 'owner-subject',
          }),
        },
        schools: {
          findById: async () => ({ id: 'school-1', ownerSubjectId: 'owner-subject' }),
        },
        staffPermissionAssignments: { list: async () => [] },
      } as never,
    })

    expect(grants?.isElevated).toBe(true)
  })

  test('builds effective grants from active permission assignments', async () => {
    const now = new Date('2026-09-01T00:00:00Z')
    const grants = await resolveStaffGrantsFromPermissionAssignments({
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      academicYearId: 'year-1',
      now,
      repositories: {
        staffMembers: {
          findById: async () => ({
            id: 'staff-1',
            schoolId: 'school-1',
            isActive: true,
            subjectId: 'subject-1',
          }),
        },
        staffPermissionAssignments: {
          list: async () => [{
            id: 'spa-1',
            staffId: 'staff-1',
            schoolId: 'school-1',
            academicYearId: 'year-1',
            permission: Permission.STUDENT_READ,
            scopeIds: '',
            status: 'active',
            endsAt: new Date('2026-12-31T00:00:00Z'),
          }],
        },
      } as never,
    })

    expect(grants?.permissions.has(Permission.STUDENT_READ)).toBe(true)
    expect(grants?.expiresAt).toEqual(new Date('2026-12-31T00:00:00Z'))
  })

  test('ignores assignments outside their validity window', async () => {
    const now = new Date('2026-09-01T00:00:00Z')
    await expect(resolveStaffGrantsFromPermissionAssignments({
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      academicYearId: 'year-1',
      now,
      repositories: {
        staffMembers: {
          findById: async () => ({
            id: 'staff-1',
            schoolId: 'school-1',
            isActive: true,
            subjectId: 'subject-1',
          }),
        },
        staffPermissionAssignments: {
          list: async () => [{
            id: 'spa-1',
            staffId: 'staff-1',
            schoolId: 'school-1',
            academicYearId: 'year-1',
            permission: Permission.STUDENT_READ,
            scopeIds: '',
            status: 'active',
            startsAt: new Date('2026-10-01T00:00:00Z'),
          }],
        },
      } as never,
    })).resolves.toBeUndefined()
  })
})
