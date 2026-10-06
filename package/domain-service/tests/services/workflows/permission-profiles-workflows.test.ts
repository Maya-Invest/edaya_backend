import { ActorAssuranceLevel, AuthorizationError, createStaffActorMetadata } from '@edaya/authorization'
import { AcademicYear, ClassGroup, GradeLevel, Permission, StaffMember } from '@edaya/core'
import { describe, expect, spyOn, test } from 'bun:test'
import { resolveStaffProfileGrants } from '../../../src/capabilities/access-control/resolve-staff-profile-grants'
import { ensureSchoolPermissionProfiles } from '../../../src/capabilities/access-control/seed-staff-permission-profiles'
import { STAFF_INVITE_PERMISSION_PRESETS } from '../../../src/capabilities/onboarding/default-access-roles'
import { createTestApp } from '../../support/create-test-app'
import { createTestStaffActor } from '../../support/test-actor'

async function createProfileContext() {
  const fixture = await createTestApp(createTestStaffActor('sch1', 'staff-admin'), { owner: true })
  const repositories = fixture.schoolRepositories
  await repositories.academicYears.save(new AcademicYear({
    id: 'ay1',
    schoolId: 'sch1',
    name: 'Year',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    status: 'published',
  }))
  await repositories.staffMembers.save(new StaffMember({
    id: 'st1',
    schoolId: 'sch1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@school.edu',
  }))
  await repositories.gradeLevels.save(new GradeLevel({
    id: 'grade-1',
    schoolId: 'sch1',
    name: 'Grade 7',
    label: 'G7',
    order: 7,
  }))
  await repositories.classGroups.save(new ClassGroup({
    id: 'class-a',
    schoolId: 'sch1',
    academicYearId: 'ay1',
    gradeLevelId: 'grade-1',
    name: '7A',
  }))
  return { repositories, service: fixture.app, fixture }
}

async function limitedAdministrator() {
  const context = await createProfileContext()
  await context.repositories.staffMembers.save(new StaffMember({ id: 'limited', schoolId: 'sch1', firstName: 'Limited', lastName: 'Admin', subjectId: 'limited-subject' }))
  for (const [id, permission, scopes] of [
    ['assign', Permission.ACCESS_CONTROL_ASSIGN, [{ kind: 'school' }]],
    ['configure', Permission.ACCESS_CONTROL_CONFIGURE, [{ kind: 'school' }]],
    ['grade', Permission.GRADE_INPUT, [{ kind: 'class_group', classGroupId: 'class-a' }]],
  ] as const) await context.service.accessControlWorkflow.assignStaffPermission({ id, schoolId: 'sch1', staffId: 'limited', academicYearId: 'ay1', permission, customScopes: [...scopes], useDefaultScopes: false })
  const app = context.fixture.forActor(createStaffActorMetadata({ subjectId: 'limited-subject', staffMemberId: 'limited', schoolId: 'sch1', academicYearId: 'ay1', requestId: 'regression', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Strong }))
  return { ...context, admin: app.accessControlWorkflow }
}

describe('permission profile workflows', () => {
  test('limited administrators revoke grading without redelegating unchanged payment access', async () => {
    const { repositories, service, admin } = await limitedAdministrator()
    const grading = { id: 'grading', schoolId: 'sch1', staffId: 'st1', academicYearId: 'ay1', permission: Permission.GRADE_INPUT, customScopes: [{ kind: 'class_group' as const, classGroupId: 'class-a' }], useDefaultScopes: false }
    await service.accessControlWorkflow.assignStaffPermission(grading)
    await service.accessControlWorkflow.assignStaffPermission({ ...grading, id: 'payment', permission: Permission.PAYMENT_READ, customScopes: [{ kind: 'school' }] })
    const payment = (await repositories.staffPermissionAssignments.findById('mpg:payment'))!.data
    const preview = await admin.assignStaffPermission({ ...grading, customScopes: [], previewOnly: true })
    expect(preview.resolution.changes).toEqual([expect.objectContaining({ permission: Permission.GRADE_INPUT, change: 'removed' })])
    expect(await repositories.staffPermissionAssignments.findById('mpg:grading')).toBeDefined()
    await admin.removeStaffPermission({ assignmentId: 'grading' })
    expect(await repositories.staffManualPermissionAssignments.findById('grading')).toBeUndefined()
    expect(await repositories.staffPermissionAssignments.findById('mpg:grading')).toBeUndefined()
    expect((await repositories.staffPermissionAssignments.findById('mpg:payment'))!.data).toEqual(payment)
  })

  test('unauthorized additions, expansion, and validity changes fail in preview and save atomically', async () => {
    const { repositories, service, admin } = await limitedAdministrator()
    const input = { id: 'm', schoolId: 'sch1', staffId: 'st1', academicYearId: 'ay1', permission: Permission.GRADE_INPUT, customScopes: [{ kind: 'class_group' as const, classGroupId: 'class-a' }], useDefaultScopes: false, endsAt: new Date('2026-12-01') }
    await service.accessControlWorkflow.assignStaffPermission({ ...input, id: 'grade', staffId: 'limited' })
    await service.accessControlWorkflow.assignStaffPermission(input)
    const before = (await repositories.staffPermissionAssignments.findById('mpg:m'))!.data
    for (const change of [
      { permission: Permission.PAYMENT_READ, customScopes: [{ kind: 'school' as const }] },
      { customScopes: [{ kind: 'all' as const, grain: 'class_group' as const }] },
      { endsAt: new Date('2026-12-31') },
    ]) {
      for (const previewOnly of [true, false]) await expect(admin.assignStaffPermission({ ...input, ...change, previewOnly })).rejects.toBeInstanceOf(AuthorizationError)
      expect((await repositories.staffPermissionAssignments.findById('mpg:m'))!.data).toEqual(before)
      expect((await repositories.staffManualPermissionAssignments.findById('m'))?.endsAt).toEqual(input.endsAt)
    }
  })

  test('removal and reordering authorize newly revealed grants and roll back on failure', async () => {
    const { repositories, service, admin } = await limitedAdministrator()
    for (const id of ['first', 'fallback']) await service.accessControlWorkflow.configurePermissionProfile({ id, name: id, permissions: [Permission.GRADE_INPUT] })
    await service.accessControlWorkflow.applyStaffPermissionProfile({ staffId: 'st1', academicYearId: 'ay1', profileId: 'first', customScopes: [{ kind: 'class_group', classGroupId: 'class-a' }], useDefaultScopes: false })
    await service.accessControlWorkflow.applyStaffPermissionProfile({ staffId: 'st1', academicYearId: 'ay1', profileId: 'fallback', customScopes: [{ kind: 'all', grain: 'class_group' }], useDefaultScopes: false })
    const before = (await repositories.staffPermissionProfileBindings.list({ staffId: 'st1' })).map(row => row.data)
    await expect(admin.removeStaffPermissionProfile({ staffId: 'st1', academicYearId: 'ay1', profileId: 'first' })).rejects.toBeInstanceOf(AuthorizationError)
    await expect(admin.reorderStaffPermissionProfiles({ staffId: 'st1', academicYearId: 'ay1', profileIds: ['fallback', 'first'] })).rejects.toBeInstanceOf(AuthorizationError)
    expect((await repositories.staffPermissionProfileBindings.list({ staffId: 'st1' })).map(row => row.data)).toEqual(before)
    expect((await repositories.staffPermissionAssignments.list({ staffId: 'st1' })).map(row => row.scopes)).toEqual([[{ kind: 'class_group', classGroupId: 'class-a' }]])
  })

  test('unchanged regeneration does not rewrite grants or warnings', async () => {
    const { repositories, service } = await createProfileContext()
    await service.accessControlWorkflow.configurePermissionProfile({ id: 'p', name: 'Read', permissions: [Permission.STAFF_READ] })
    await service.accessControlWorkflow.applyStaffPermissionProfile({ staffId: 'st1', profileId: 'p', academicYearId: 'ay1', customScopes: [{ kind: 'school' }], useDefaultScopes: false })
    await service.accessControlWorkflow.assignStaffPermission({ id: 'm', schoolId: 'sch1', staffId: 'st1', academicYearId: 'ay1', permission: Permission.GRADE_READ, customScopes: [{ kind: 'class_group', classGroupId: 'class-a' }], useDefaultScopes: false })
    const spies = [
      spyOn(repositories.staffPermissionAssignments, 'save'),
      spyOn(repositories.staffPermissionProfileBindings, 'save'),
      spyOn(repositories.staffManualPermissionAssignments, 'save'),
    ]
    try {
      expect((await resolveStaffProfileGrants({ repositories, staffId: 'st1' })).changes).toEqual([])
      for (const spy of spies) expect(spy).not.toHaveBeenCalled()
    }
    finally {
      for (const spy of spies) spy.mockRestore()
    }
  })

  test('changing a manual permission previews removed and added access without changing the saved grant', async () => {
    const { repositories, service } = await createProfileContext()
    const input = { id: 'm', schoolId: 'sch1', staffId: 'st1', academicYearId: 'ay1', permission: Permission.GRADE_READ, customScopes: [{ kind: 'class_group' as const, classGroupId: 'class-a' }], useDefaultScopes: false }
    await service.accessControlWorkflow.assignStaffPermission(input)
    const updated = { ...input, permission: Permission.GRADE_INPUT }
    const preview = await service.accessControlWorkflow.assignStaffPermission({ ...updated, previewOnly: true })
    expect(preview.resolution.changes.map(row => [row.permission, row.change])).toEqual([[Permission.GRADE_READ, 'removed'], [Permission.GRADE_INPUT, 'added']])
    expect((await repositories.staffPermissionAssignments.findById('mpg:m'))?.permission).toBe(Permission.GRADE_READ)
    await service.accessControlWorkflow.assignStaffPermission(updated)
    expect((await repositories.staffPermissionAssignments.findById('mpg:m'))?.permission).toBe(Permission.GRADE_INPUT)
  })

  test('seeds one mixed-scope bundle per preset', async () => {
    const { repositories } = await createProfileContext()
    await ensureSchoolPermissionProfiles(repositories, 'sch1')
    const profiles = await repositories.staffPermissionProfiles.list({ schoolId: 'sch1' })
    expect(profiles).toHaveLength(STAFF_INVITE_PERMISSION_PRESETS.length)
    expect(profiles.find(row => row.sourceKey === 'role-coordinator')?.permissions).toEqual(
      [...STAFF_INVITE_PERMISSION_PRESETS.find(row => row.id === 'role-coordinator')!.permissions],
    )
  })

  test('mixed bundles generate only permissions with an applicable explicit scope', async () => {
    const { repositories, service } = await createProfileContext()
    await service.accessControlWorkflow.configurePermissionProfile({ id: 'mixed', name: 'Mixed', permissions: [Permission.PAYMENT_READ, Permission.GRADE_INPUT, Permission.EXAM_CONFIG_READ] })
    const binding = await service.accessControlWorkflow.applyStaffPermissionProfile({ staffId: 'st1', profileId: 'mixed', academicYearId: 'ay1', customScopes: [{ kind: 'school' }, { kind: 'class_group', classGroupId: 'class-a' }], useDefaultScopes: false })
    const grants = await repositories.staffPermissionAssignments.list({ staffId: 'st1' })
    expect(grants.map(row => row.permission).sort()).toEqual([Permission.PAYMENT_READ, Permission.GRADE_INPUT].sort())
    expect(binding.resolution.warnings).toContainEqual(expect.objectContaining({ permission: Permission.EXAM_CONFIG_READ, reason: 'missing_scope' }))
    expect((await repositories.staffPermissionProfileBindings.findById(binding.id))?.warnings).toEqual(binding.warnings)
  })

  test('default changes are additive and preserve custom profile and manual selections', async () => {
    const { repositories, service } = await createProfileContext()
    for (const id of ['class-b', 'class-c']) await repositories.classGroups.save(new ClassGroup({ id, schoolId: 'sch1', academicYearId: 'ay1', gradeLevelId: 'grade-1', name: id }))
    await service.accessControlWorkflow.configurePermissionProfile({ id: 'p', name: 'Grades', permissions: [Permission.GRADE_INPUT] })
    await service.accessControlWorkflow.configureStaffPermissionScopeDefaults({ staffId: 'st1', academicYearId: 'ay1', scopes: [{ kind: 'class_group', classGroupId: 'class-a' }] })
    const binding = await service.accessControlWorkflow.applyStaffPermissionProfile({ staffId: 'st1', profileId: 'p', academicYearId: 'ay1', customScopes: [{ kind: 'class_group', classGroupId: 'class-b' }], useDefaultScopes: true })
    await service.accessControlWorkflow.assignStaffPermission({ id: 'm', schoolId: 'sch1', staffId: 'st1', academicYearId: 'ay1', permission: Permission.GRADE_READ, customScopes: [{ kind: 'class_group', classGroupId: 'class-b' }], useDefaultScopes: true })
    const result = await service.accessControlWorkflow.configureStaffPermissionScopeDefaults({ staffId: 'st1', academicYearId: 'ay1', scopes: [{ kind: 'class_group', classGroupId: 'class-c' }] })
    expect(result.resolution.changes).toHaveLength(2)
    const grants = await repositories.staffPermissionAssignments.list({ staffId: 'st1' })
    for (const grant of grants) expect(grant.scopes).toEqual([{ kind: 'class_group', classGroupId: 'class-b' }, { kind: 'class_group', classGroupId: 'class-c' }])
    expect((await repositories.staffPermissionProfileBindings.findById(binding.id))?.customScopes).toEqual([{ kind: 'class_group', classGroupId: 'class-b' }])
    expect((await repositories.staffManualPermissionAssignments.findById('m'))?.customScopes).toEqual([{ kind: 'class_group', classGroupId: 'class-b' }])
    await service.accessControlWorkflow.applyStaffPermissionProfile({ staffId: 'st1', profileId: 'p', academicYearId: 'ay1', customScopes: [{ kind: 'class_group', classGroupId: 'class-b' }], useDefaultScopes: false })
    expect((await repositories.staffPermissionAssignments.list({ sourceProfileId: 'p' }))[0]?.scopes).toEqual([{ kind: 'class_group', classGroupId: 'class-b' }])
  })

  test('empty defaults remove generated access and correcting defaults restores saved requests', async () => {
    const { repositories, service } = await createProfileContext()
    await service.accessControlWorkflow.configurePermissionProfile({ id: 'p', name: 'Grades', permissions: [Permission.GRADE_INPUT] })
    await service.accessControlWorkflow.configureStaffPermissionScopeDefaults({ staffId: 'st1', academicYearId: 'ay1', scopes: [{ kind: 'class_group', classGroupId: 'class-a' }] })
    const binding = await service.accessControlWorkflow.applyStaffPermissionProfile({ staffId: 'st1', profileId: 'p', academicYearId: 'ay1', customScopes: [], useDefaultScopes: true })
    await service.accessControlWorkflow.assignStaffPermission({ id: 'm', schoolId: 'sch1', staffId: 'st1', academicYearId: 'ay1', permission: Permission.GRADE_READ, customScopes: [], useDefaultScopes: true })
    const result = await service.accessControlWorkflow.configureStaffPermissionScopeDefaults({ staffId: 'st1', academicYearId: 'ay1', scopes: [] })
    expect(result.resolution.changes.every(row => row.change === 'removed')).toBe(true)
    expect(await repositories.staffPermissionAssignments.list({ staffId: 'st1' })).toHaveLength(0)
    expect((await repositories.staffPermissionProfileBindings.findById(binding.id))?.warnings).toContainEqual({ permission: Permission.GRADE_INPUT, reason: 'missing_scope' })
    expect(await repositories.staffManualPermissionAssignments.findById('m')).toBeDefined()
    await service.accessControlWorkflow.configureStaffPermissionScopeDefaults({ staffId: 'st1', academicYearId: 'ay1', scopes: [{ kind: 'class_group', classGroupId: 'class-a' }] })
    expect(await repositories.staffPermissionAssignments.list({ staffId: 'st1' })).toHaveLength(2)
    expect((await repositories.staffManualPermissionAssignments.findById('m'))?.warnings).toEqual([])
  })

  test('preview does not write and profile edits withdraw obsolete permissions', async () => {
    const { repositories, service } = await createProfileContext()
    await service.accessControlWorkflow.configurePermissionProfile({ id: 'p', name: 'Grades', permissions: [Permission.GRADE_INPUT] })
    await service.accessControlWorkflow.applyStaffPermissionProfile({ staffId: 'st1', profileId: 'p', academicYearId: 'ay1', customScopes: [{ kind: 'class_group', classGroupId: 'class-a' }], useDefaultScopes: false })
    const preview = await service.accessControlWorkflow.configurePermissionProfile({ id: 'p', name: 'Exams', permissions: [Permission.EXAM_CONFIG_READ], previewOnly: true })
    expect(preview.resolution.changes[0]?.change).toBe('removed')
    expect((await repositories.staffPermissionProfiles.findById('p'))?.name).toBe('Grades')
    expect(await repositories.staffPermissionAssignments.list({ staffId: 'st1' })).toHaveLength(1)
    await service.accessControlWorkflow.configurePermissionProfile({ id: 'p', name: 'Exams', permissions: [Permission.EXAM_CONFIG_READ] })
    expect(await repositories.staffPermissionAssignments.list({ staffId: 'st1' })).toHaveLength(0)
    expect((await repositories.staffPermissionProfileBindings.list({ staffId: 'st1' }))[0]?.customScopes).toEqual([{ kind: 'class_group', classGroupId: 'class-a' }])
  })

  test('first profile owns a permission even when its scope cannot resolve', async () => {
    const { repositories, service } = await createProfileContext()
    for (const id of ['first', 'second']) await service.accessControlWorkflow.configurePermissionProfile({ id, name: id, permissions: [Permission.GRADE_INPUT] })
    await service.accessControlWorkflow.applyStaffPermissionProfile({ staffId: 'st1', profileId: 'first', academicYearId: 'ay1', customScopes: [], useDefaultScopes: false })
    const second = await service.accessControlWorkflow.applyStaffPermissionProfile({ staffId: 'st1', profileId: 'second', academicYearId: 'ay1', customScopes: [{ kind: 'all', grain: 'class_group' }], useDefaultScopes: false })
    expect(await repositories.staffPermissionAssignments.list({ staffId: 'st1' })).toHaveLength(0)
    expect(second.warnings).toContainEqual({ permission: Permission.GRADE_INPUT, reason: 'shadowed', ownerProfileId: 'first' })
    await service.accessControlWorkflow.reorderStaffPermissionProfiles({ staffId: 'st1', academicYearId: 'ay1', profileIds: ['second', 'first'] })
    expect((await repositories.staffPermissionAssignments.list({ staffId: 'st1' }))[0]?.sourceProfileId).toBe('second')
    await service.accessControlWorkflow.removeStaffPermissionProfile({ staffId: 'st1', academicYearId: 'ay1', profileId: 'second' })
    expect(await repositories.staffPermissionAssignments.list({ staffId: 'st1' })).toHaveLength(0)
  })

  test('the same profile can be assigned in separate years and default updates are isolated', async () => {
    const { repositories, service } = await createProfileContext()
    await repositories.academicYears.save(new AcademicYear({ id: 'ay2', schoolId: 'sch1', name: 'Next', startDate: new Date('2027-01-01'), endDate: new Date('2027-12-31'), status: 'draft' }))
    await service.accessControlWorkflow.configurePermissionProfile({ id: 'p', name: 'Read', permissions: [Permission.STAFF_READ] })
    for (const year of ['ay1', 'ay2']) {
      await service.accessControlWorkflow.configureStaffPermissionScopeDefaults({ staffId: 'st1', academicYearId: year, scopes: [{ kind: 'school' }] })
      await service.accessControlWorkflow.applyStaffPermissionProfile({ staffId: 'st1', profileId: 'p', academicYearId: year, customScopes: [], useDefaultScopes: true })
    }
    await service.accessControlWorkflow.configureStaffPermissionScopeDefaults({ staffId: 'st1', academicYearId: 'ay1', scopes: [] })
    expect(await repositories.staffPermissionAssignments.list({ staffId: 'st1', academicYearId: 'ay1' })).toHaveLength(0)
    expect(await repositories.staffPermissionAssignments.list({ staffId: 'st1', academicYearId: 'ay2' })).toHaveLength(1)
  })

  test('catalog deletion freezes unique grants as explicit manual assignments', async () => {
    const { repositories, service } = await createProfileContext()
    await service.accessControlWorkflow.configurePermissionProfile({ id: 'p', name: 'Read', permissions: [Permission.STAFF_READ] })
    await service.accessControlWorkflow.applyStaffPermissionProfile({ staffId: 'st1', profileId: 'p', academicYearId: 'ay1', customScopes: [{ kind: 'school' }], useDefaultScopes: false })
    await service.baseService.entities.staffPermissionProfiles.delete('p')
    const grants = await repositories.staffPermissionAssignments.list({ staffId: 'st1' })
    expect(grants).toHaveLength(1)
    expect(grants[0]?.sourceProfileId).toBeUndefined()
    expect(grants[0]?.sourceManualAssignmentId).toBeDefined()
    expect((await repositories.staffManualPermissionAssignments.list({ staffId: 'st1' }))[0]?.useDefaultScopes).toBe(false)
  })

  test('catalog deletion preserves unique access independently in each year', async () => {
    const { repositories, service } = await createProfileContext()
    await repositories.academicYears.save(new AcademicYear({ id: 'ay2', schoolId: 'sch1', name: 'Next', startDate: new Date('2027-01-01'), endDate: new Date('2027-12-31'), status: 'draft' }))
    for (const id of ['p', 'next']) await service.accessControlWorkflow.configurePermissionProfile({ id, name: id, permissions: [Permission.STAFF_READ] })
    await service.accessControlWorkflow.applyStaffPermissionProfile({ staffId: 'st1', profileId: 'p', academicYearId: 'ay1', customScopes: [{ kind: 'school' }], useDefaultScopes: false })
    await service.accessControlWorkflow.applyStaffPermissionProfile({ staffId: 'st1', profileId: 'next', academicYearId: 'ay2', customScopes: [{ kind: 'school' }], useDefaultScopes: false })
    await service.baseService.entities.staffPermissionProfiles.delete('p')
    expect(await repositories.staffPermissionAssignments.list({ staffId: 'st1', academicYearId: 'ay1' })).toHaveLength(1)
    expect(await repositories.staffPermissionAssignments.list({ staffId: 'st1', academicYearId: 'ay2' })).toHaveLength(1)
  })

  test('missing saved targets remove generated grants but keep the repairable source', async () => {
    const { repositories, service } = await createProfileContext()
    await service.accessControlWorkflow.configurePermissionProfile({ id: 'p', name: 'Grades', permissions: [Permission.GRADE_INPUT] })
    const binding = await service.accessControlWorkflow.applyStaffPermissionProfile({ staffId: 'st1', profileId: 'p', academicYearId: 'ay1', customScopes: [{ kind: 'class_group', classGroupId: 'class-a' }], useDefaultScopes: false })
    await repositories.classGroups.delete('class-a')
    const report = await resolveStaffProfileGrants({ repositories, staffId: 'st1' })
    expect(report.changes[0]?.change).toBe('removed')
    expect(report.warnings).toContainEqual(expect.objectContaining({ reason: 'invalid_scope' }))
    expect((await repositories.staffPermissionProfileBindings.findById(binding.id))?.customScopes).toEqual([{ kind: 'class_group', classGroupId: 'class-a' }])
    expect(await repositories.staffPermissionAssignments.list({ staffId: 'st1' })).toHaveLength(0)
  })

  test('new selections reject class targets from a different academic year', async () => {
    const { repositories, service } = await createProfileContext()
    await repositories.academicYears.save(new AcademicYear({ id: 'ay2', schoolId: 'sch1', name: 'Next', startDate: new Date('2027-01-01'), endDate: new Date('2027-12-31'), status: 'draft' }))
    await expect(service.accessControlWorkflow.configureStaffPermissionScopeDefaults({ staffId: 'st1', academicYearId: 'ay2', scopes: [{ kind: 'class_group', classGroupId: 'class-a' }] })).rejects.toThrow('Scope target')
    expect(await repositories.staffPermissionScopeDefaults.list({ staffId: 'st1' })).toHaveLength(0)
  })

  test('delegation denial rolls back defaults and generated grants', async () => {
    const { repositories, service, fixture } = await createProfileContext()
    await repositories.staffMembers.save(new StaffMember({ id: 'limited', schoolId: 'sch1', firstName: 'Limited', lastName: 'Admin', subjectId: 'subject-limited' }))
    await service.accessControlWorkflow.assignStaffPermission({ id: 'limited-assign', schoolId: 'sch1', staffId: 'limited', academicYearId: 'ay1', permission: Permission.ACCESS_CONTROL_ASSIGN, customScopes: [{ kind: 'school' }], useDefaultScopes: false })
    await service.accessControlWorkflow.configurePermissionProfile({ id: 'p', name: 'Grades', permissions: [Permission.GRADE_INPUT] })
    await service.accessControlWorkflow.applyStaffPermissionProfile({ staffId: 'st1', profileId: 'p', academicYearId: 'ay1', customScopes: [], useDefaultScopes: true })
    const limited = fixture.forActor(createStaffActorMetadata({ subjectId: 'subject-limited', staffMemberId: 'limited', schoolId: 'sch1', requestId: 'request', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Strong }))
    await expect(limited.accessControlWorkflow.configureStaffPermissionScopeDefaults({ staffId: 'st1', academicYearId: 'ay1', scopes: [{ kind: 'all', grain: 'class_group' }] })).rejects.toBeInstanceOf(AuthorizationError)
    expect(await repositories.staffPermissionScopeDefaults.list({ staffId: 'st1' })).toHaveLength(0)
    expect(await repositories.staffPermissionAssignments.list({ staffId: 'st1' })).toHaveLength(0)
  })
})
