import {
  Permission,
  resolveEffectiveGrants,
  StaffAssignment,
  StaffMember,
  StaffRole,
  syncStaffSystemRoleAssignment,
} from '@edaya/core'
import { expect, test } from 'bun:test'
import { describeIntegration } from '../support/suite-runner'
import { createTestApp } from '../utils/test-adapter'

describeIntegration('access control persistence', () => {
  test('backfill and resolve grants from postgres', async () => {
    const { schoolRepositories: repos } = createTestApp()

    await repos.staffMembers.save(new StaffMember({
      id: 'staff-teacher-1',
      schoolId: 'school',
      firstName: 'Marie',
      lastName: 'Dupont',
    }))

    await repos.staffAssignments.save(new StaffAssignment({
      id: 'teaching-assign-1',
      staffId: 'staff-teacher-1',
      role: StaffRole.Teacher,
      classGroupId: 'class-6a',
    }))

    await syncStaffSystemRoleAssignment({
      staffMemberId: 'staff-teacher-1',
      schoolId: 'school',
      repositories: repos,
      roleKeys: [StaffRole.Teacher],
    })

    const grants = await resolveEffectiveGrants({
      staffMemberId: 'staff-teacher-1',
      schoolId: 'school',
      repositories: repos,
    })

    expect(grants.permissions.has(Permission.ATTENDANCE_RECORD)).toBe(true)
    expect(grants.scopeGrants.some(grant =>
      grant.permission === Permission.ATTENDANCE_RECORD
      && grant.scopeType === 'class_group'
      && grant.scopeEntityIds.includes('class-6a'))).toBe(true)
  })
})
