import { AccessPolicies, ActorAssuranceLevel, createStaffActorMetadata, describeActionGrants, Permission } from '@edaya/authorization'
import { AcademicYear, ClassGroup, GradeLevel, StaffAssignment, StaffMember, StaffPermissionAssignment } from '@edaya/core'
import { expect, test } from 'bun:test'
import { describeIntegration } from '../support/suite-runner'
import { createTestApp } from '../utils/test-adapter'

async function fixture() {
  const { schoolRepositories: repos } = await createTestApp()
  await repos.academicYears.save(new AcademicYear({ id: 'year', schoolId: 'school', name: 'Year', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), status: 'published' }))
  await repos.gradeLevels.save(new GradeLevel({ id: 'level', schoolId: 'school', name: 'Level', label: 'Level', order: 1 }))
  for (const id of ['class', 'other'])
    await repos.classGroups.save(new ClassGroup({ id, schoolId: 'school', academicYearId: 'year', gradeLevelId: 'level', name: id }))
  await repos.staffMembers.save(new StaffMember({ id: 'staff', schoolId: 'school', firstName: 'Marie', lastName: 'Dupont', subjectId: 'person' }))
  const actor = createStaffActorMetadata({ staffMemberId: 'staff', subjectId: 'person', schoolId: 'school', academicYearId: 'year', requestId: 'persistence-test', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Strong })
  return { repos, actor, access: () => new AccessPolicies(actor, repos) }
}

describeIntegration('typed staff authorization persistence', () => {
  test('manual grants retain their action, placement, validity and provenance', async () => {
    const { repos, actor, access } = await fixture()
    const row = new StaffPermissionAssignment({ id: 'manual', staffId: 'staff', schoolId: 'school', academicYearId: 'year', permission: Permission.ATTENDANCE_RECORD, scopes: [{ kind: 'class_group', classGroupId: 'class' }], startsAt: new Date('2020-01-01'), endsAt: new Date('2099-01-01') })
    await repos.staffPermissionAssignments.save(row)
    expect((await repos.staffPermissionAssignments.findById(row.id))?.scopes).toEqual(row.scopes)
    expect(await describeActionGrants(actor, repos)).toContainEqual(expect.objectContaining({ permission: row.permission, scopes: row.scopes, source: 'manual', startsAt: row.startsAt, endsAt: row.endsAt }))
    await access().assertResources(Permission.ATTENDANCE_RECORD, 'classGroups', ['class'], 'write')
    await expect(access().assertResources(Permission.ATTENDANCE_RECORD, 'classGroups', ['other'], 'write')).rejects.toMatchObject({ code: 'forbidden' })
    await expect(access().assertResources(Permission.GRADE_INPUT, 'classGroups', ['class'], 'write')).rejects.toMatchObject({ code: 'forbidden' })
    await repos.staffPermissionAssignments.save(new StaffPermissionAssignment({ ...row.data, endsAt: new Date('2021-01-01') }))
    await expect(access().assertResources(Permission.ATTENDANCE_RECORD, 'classGroups', ['class'], 'write')).rejects.toMatchObject({ code: 'forbidden' })
  })

  test('assignments supply authority directly; responsibility labels and deleted assignments supply none', async () => {
    const { repos, actor, access } = await fixture()
    const assignment = new StaffAssignment({ id: 'assignment', staffId: 'staff', academicYearId: 'year', responsibility: 'principal', classGroupId: 'class', permissions: [] })
    await repos.staffAssignments.save(assignment)
    await expect(access().assertResources(Permission.ATTENDANCE_RECORD, 'classGroups', ['class'], 'write')).rejects.toMatchObject({ code: 'forbidden' })
    await repos.staffAssignments.save(new StaffAssignment({ ...assignment.data, permissions: [Permission.ATTENDANCE_RECORD] }))
    await access().assertResources(Permission.ATTENDANCE_RECORD, 'classGroups', ['class'], 'write')
    expect(await describeActionGrants(actor, repos)).toContainEqual(expect.objectContaining({ permission: Permission.ATTENDANCE_RECORD, source: 'assignment' }))
    expect(await repos.staffPermissionAssignments.count()).toBe(0)
    await repos.staffAssignments.delete(assignment.id)
    await expect(access().assertResources(Permission.ATTENDANCE_RECORD, 'classGroups', ['class'], 'write')).rejects.toMatchObject({ code: 'forbidden' })
  })
})
