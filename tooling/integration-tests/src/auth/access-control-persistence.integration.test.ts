import {
  AccessRole,
  Permission,
  StaffAssignment,
  StaffMember,
  StaffRoleAssignment,
} from '@edaya/core'
import { expect, test } from 'bun:test'
import { describeIntegration } from '../support/suite-runner'
import { createTestApp } from '../utils/test-adapter'

describeIntegration('access control persistence', () => {
  test('backfill and resolve grants from postgres', async () => {
    const { schoolRepositories: repos } = await createTestApp()

    await repos.staffMembers.save(new StaffMember({
      id: 'staff-teacher-1',
      schoolId: 'school',
      firstName: 'Marie',
      lastName: 'Dupont',
    }))

    await repos.staffAssignments.save(new StaffAssignment({
      id: 'teaching-assign-1',
      staffId: 'staff-teacher-1',
      responsibility: 'teacher',
      classGroupId: 'class-6a',
    }))

    await repos.accessRoles.save(new AccessRole({
      id: 'role-teacher-1',
      schoolId: 'school',
      name: 'Teacher',
      permissions: [Permission.ATTENDANCE_RECORD],
    }))

    await repos.staffRoleAssignments.save(new StaffRoleAssignment({
      id: 'assignment-teacher-1',
      staffId: 'staff-teacher-1',
      schoolId: 'school',
      roleIds: ['role-teacher-1'],
      scopeGrants: [],
      status: 'active',
    }))

    const grants = await repos.authorization.resolveEffectiveGrants({
      staffMemberId: 'staff-teacher-1',
      schoolId: 'school',
    })

    expect(grants.permissions.has(Permission.ATTENDANCE_RECORD)).toBe(true)
    expect(grants.scopeGrants.some(grant =>
      grant.permission === Permission.ATTENDANCE_RECORD
      && grant.scopeType === 'class_group'
      && grant.scopeEntityIds.includes('class-6a'))).toBe(true)
  })
})
