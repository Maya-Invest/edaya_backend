import {
  Permission,
  StaffAssignment,
  StaffMember,
  StaffPermissionAssignment,
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
      academicYearId: 'year-1',
      responsibility: 'teacher',
      classGroupId: 'class-6a',
    }))

    await repos.staffPermissionAssignments.save(new StaffPermissionAssignment({
      id: 'spa-teacher-attendance',
      staffId: 'staff-teacher-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      permission: Permission.ATTENDANCE_RECORD,
      scopeIds: 'class-6a:*',
      status: 'active',
    }))

    const grants = await repos.authorization.resolveEffectiveGrants({
      staffMemberId: 'staff-teacher-1',
      schoolId: 'school',
      academicYearId: 'year-1',
    })

    expect(grants.permissions.has(Permission.ATTENDANCE_RECORD)).toBe(true)
    expect(grants.scopeIdsByPermission?.[Permission.ATTENDANCE_RECORD]).toBe('class-6a:*')
  })
})
