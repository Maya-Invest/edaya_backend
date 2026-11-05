import { ActorAssuranceLevel, AuthorizationError, createStaffActorMetadata } from '@edaya/authorization'
import { AcademicYear, ClassGroup, GradeLevel, Permission, StaffMember, withShortName } from '@edaya/core'
import { describe, expect, spyOn, test } from 'bun:test'
import { resolveStaffProfileGrants } from '../../../src/capabilities/access-control/resolve-staff-profile-grants'
import { ensureSchoolPermissionProfiles } from '../../../src/capabilities/access-control/seed-staff-permission-profiles'
import { STAFF_INVITE_PERMISSION_PRESETS } from '../../../src/capabilities/onboarding/default-access-roles'
import { createTestApp } from '../../support/create-test-app'
import { createTestStaffActor } from '../../support/test-actor'

async function createProfileContext() {
  const fixture = await createTestApp(createTestStaffActor('sch1', 'staff-admin'), { owner: true })
  const repositories = fixture.schoolRepositories
  await repositories.academicYears.save(new AcademicYear(withShortName({
    id: 'ay1',
    schoolId: 'sch1',
    name: 'Year',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    status: 'published',
  })))
  await repositories.staffMembers.save(new StaffMember({
    id: 'st1',
    schoolId: 'sch1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@school.edu',
  }))
  await repositories.gradeLevels.save(new GradeLevel(withShortName({
    id: 'grade-1',
    schoolId: 'sch1',
    name: 'Grade 7',
    shortName: 'G7',
    order: 7,
  })))
  await repositories.classGroups.save(new ClassGroup(withShortName({
    id: 'class-a',
    schoolId: 'sch1',
    academicYearId: 'ay1',
    gradeLevelId: 'grade-1',
    name: '7A',
  })))
  return { repositories, service: fixture.app, fixture }
}

async function limitedAdministrator() {
  const context = await createProfileContext()
  await context.repositories.staffMembers.save(new StaffMember({ id: 'limited', schoolId: 'sch1', firstName: 'Limited', lastName: 'Admin', subjectId: 'limited-subject' }))
  for (const [id, permission, scopes] of [
    ['assign', Permission.ACCESS_CONTROL_MANAGE, []],
    ['configure', Permission.ACCESS_CONTROL_MANAGE, []],
    ['grade', Permission.GRADE_MANAGE, [{ kind: 'class_group', classGroupId: 'class-a' }]],
  ] as const) await context.service.accessControlWorkflow.assignStaffPermission({ id, schoolId: 'sch1', staffId: 'limited', academicYearId: 'ay1', permission, customScopes: [...scopes], useDefaultScopes: false })
  const app = context.fixture.forActor(createStaffActorMetadata({ subjectId: 'limited-subject', staffMemberId: 'limited', schoolId: 'sch1', academicYearId: 'ay1', requestId: 'regression', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Strong }))
  return { ...context, admin: app.accessControlWorkflow }
}

describe('permission profile workflows', () => {
  test('Subject defaults, profiles and manual previews retain the same class restriction on reload', async () => {
    const { repositories, service } = await createProfileContext()
    const scopes = [{ kind: 'subject' as const, gradeLevelId: 'grade-1', classGroupId: 'class-a' }]
    await service.accessControlWorkflow.configureStaffPermissionScopeDefaults({ staffId: 'st1', academicYearId: 'ay1', scopes })
    await service.accessControlWorkflow.configurePermissionProfile({ id: 'subject-profile', name: 'Subject', permissions: [Permission.ASSESSMENT_READ, Permission.ATTENDANCE_RECORD] })
    const input = { staffId: 'st1', profileId: 'subject-profile', academicYearId: 'ay1', customScopes: [], useDefaultScopes: true }
    const preview = await service.accessControlWorkflow.applyStaffPermissionProfile({ ...input, previewOnly: true })
    const saved = await service.accessControlWorkflow.applyStaffPermissionProfile(input)
    expect(saved.resolution).toEqual(preview.resolution)
    expect(saved.warnings).toEqual([])
    expect((await repositories.staffPermissionAssignments.list({ staffId: 'st1' })).map(row => row.scopes)).toEqual([scopes, scopes])
    const manual = { id: 'subject-manual', schoolId: 'sch1', staffId: 'st1', academicYearId: 'ay1', permission: Permission.GRADE_READ, customScopes: scopes, useDefaultScopes: false }
    const manualPreview = await service.accessControlWorkflow.assignStaffPermission({ ...manual, previewOnly: true })
    expect((await service.accessControlWorkflow.assignStaffPermission(manual)).resolution).toEqual(manualPreview.resolution)
    expect((await repositories.staffManualPermissionAssignments.findById(manual.id))?.customScopes).toEqual(scopes)
    const broad = await service.accessControlWorkflow.configureStaffPermissionScopeDefaults({ staffId: 'st1', academicYearId: 'ay1', scopes: [{ kind: 'subject', gradeLevelId: 'grade-1' }] })
    expect(broad.resolution.warnings).toContainEqual(expect.objectContaining({ permission: Permission.ATTENDANCE_RECORD, reason: 'missing_scope' }))
    expect((await repositories.staffPermissionAssignments.list({ staffId: 'st1' })).map(row => row.permission).sort()).toEqual([Permission.ASSESSMENT_READ, Permission.GRADE_READ].sort())
  })

  test('unscoped manual preview and save resolve identically without selections or defaults', async () => {
    const { repositories, service } = await createProfileContext()
    const input = { id: 'audit', schoolId: 'sch1', staffId: 'st1', academicYearId: 'ay1', permission: Permission.ACCESS_CONTROL_READ }
    const preview = await service.accessControlWorkflow.assignStaffPermission({ ...input, previewOnly: true })
    expect(preview.customScopes).toEqual([])
    expect(preview.useDefaultScopes).toBe(false)
    expect(preview.resolution.warnings).toEqual([])
    expect(preview.resolution.changes).toEqual([expect.objectContaining({ permission: Permission.ACCESS_CONTROL_READ, change: 'added', afterScopes: [{ kind: 'school' }] })])
    expect(await repositories.staffManualPermissionAssignments.findById('audit')).toBeUndefined()
    expect(await repositories.staffPermissionAssignments.list({ staffId: 'st1' })).toEqual([])
    const saved = await service.accessControlWorkflow.assignStaffPermission(input)
    expect(saved.resolution).toEqual(preview.resolution)
    expect((await repositories.staffPermissionAssignments.findById('mpg:audit'))?.scopes).toEqual([{ kind: 'school' }])
    expect((await repositories.staffManualPermissionAssignments.findById('audit'))?.customScopes).toEqual([])
  })

  test('mixed profiles resolve unscoped capabilities while empty scoped and review capabilities stay ineffective', async () => {
    const { repositories, service } = await createProfileContext()
    await service.accessControlWorkflow.configurePermissionProfile({ id: 'mixed', name: 'Mixed', permissions: [Permission.ACCESS_CONTROL_READ, Permission.ATTENDANCE_READ, Permission.ASSESSMENT_READ, Permission.ATTENDANCE_VALIDATE] })
    const input = { staffId: 'st1', profileId: 'mixed', academicYearId: 'ay1', customScopes: [], useDefaultScopes: true }
    const preview = await service.accessControlWorkflow.applyStaffPermissionProfile({ ...input, previewOnly: true })
    expect(await repositories.staffPermissionProfileBindings.list({ staffId: 'st1' })).toEqual([])
    expect(await repositories.staffPermissionAssignments.list({ staffId: 'st1' })).toEqual([])
    const applied = await service.accessControlWorkflow.applyStaffPermissionProfile(input)
    expect(applied.resolution.changes).toEqual(preview.resolution.changes)
    expect((await repositories.staffPermissionAssignments.list({ staffId: 'st1' })).map(row => row.permission)).toEqual([Permission.ACCESS_CONTROL_READ])
    expect(applied.warnings).toEqual([
      { permission: Permission.ATTENDANCE_READ, reason: 'missing_scope' },
      { permission: Permission.ASSESSMENT_READ, reason: 'missing_scope' },
      { permission: Permission.ATTENDANCE_VALIDATE, reason: 'missing_scope' },
    ])
    await service.accessControlWorkflow.configureStaffPermissionScopeDefaults({ staffId: 'st1', academicYearId: 'ay1', scopes: [{ kind: 'class_group', classGroupId: 'class-a' }] })
    expect((await repositories.staffPermissionAssignments.list({ staffId: 'st1' })).map(row => row.permission).sort()).toEqual([Permission.ACCESS_CONTROL_READ, Permission.ATTENDANCE_READ, Permission.ATTENDANCE_VALIDATE, Permission.ASSESSMENT_READ].sort())
    const cleared = await service.accessControlWorkflow.configureStaffPermissionScopeDefaults({ staffId: 'st1', academicYearId: 'ay1', scopes: [] })
    expect(cleared.resolution.changes.map(row => row.permission).sort()).toEqual([Permission.ATTENDANCE_READ, Permission.ATTENDANCE_VALIDATE, Permission.ASSESSMENT_READ].sort())
    expect((await repositories.staffPermissionAssignments.list({ staffId: 'st1' })).map(row => row.permission)).toEqual([Permission.ACCESS_CONTROL_READ])
  })

  test('unscoped first-wins ownership survives reordering and profile revocation without scopes', async () => {
    const { repositories, service } = await createProfileContext()
    for (const id of ['first', 'second']) {
      await service.accessControlWorkflow.configurePermissionProfile({ id, name: id, permissions: [Permission.ACCESS_CONTROL_READ] })
      await service.accessControlWorkflow.applyStaffPermissionProfile({ staffId: 'st1', profileId: id, academicYearId: 'ay1', customScopes: [], useDefaultScopes: false })
    }
    expect((await repositories.staffPermissionAssignments.list({ staffId: 'st1' }))[0]?.sourceProfileId).toBe('first')
    const second = (await repositories.staffPermissionProfileBindings.list({ staffId: 'st1' })).find(row => row.profileId === 'second')!
    expect(second.warnings).toEqual([{ permission: Permission.ACCESS_CONTROL_READ, reason: 'shadowed', ownerProfileId: 'first' }])
    await service.accessControlWorkflow.reorderStaffPermissionProfiles({ staffId: 'st1', academicYearId: 'ay1', profileIds: ['second', 'first'] })
    expect((await repositories.staffPermissionAssignments.list({ staffId: 'st1' }))[0]?.sourceProfileId).toBe('second')
    await service.accessControlWorkflow.removeStaffPermissionProfile({ staffId: 'st1', profileId: 'second', academicYearId: 'ay1' })
    expect((await repositories.staffPermissionAssignments.list({ staffId: 'st1' }))[0]?.sourceProfileId).toBe('first')
    await service.accessControlWorkflow.removeStaffPermissionProfile({ staffId: 'st1', profileId: 'first', academicYearId: 'ay1' })
    expect(await repositories.staffPermissionAssignments.list({ staffId: 'st1' })).toEqual([])
  })

  test('a manual grant remains additive when an earlier scoped profile cannot resolve', async () => {
    const { repositories, service } = await createProfileContext()
    await service.accessControlWorkflow.configurePermissionProfile({ id: 'empty', name: 'No scope', permissions: [Permission.GRADE_MANAGE] })
    await service.accessControlWorkflow.applyStaffPermissionProfile({ staffId: 'st1', profileId: 'empty', academicYearId: 'ay1', customScopes: [], useDefaultScopes: false })
    await service.accessControlWorkflow.assignStaffPermission({ id: 'manual-grade', schoolId: 'sch1', staffId: 'st1', academicYearId: 'ay1', permission: Permission.GRADE_MANAGE, customScopes: [{ kind: 'class_group', classGroupId: 'class-a' }], useDefaultScopes: false })
    expect((await repositories.staffPermissionAssignments.list({ staffId: 'st1' })).map(row => row.sourceManualAssignmentId)).toEqual(['manual-grade'])
    await service.accessControlWorkflow.removeStaffPermission({ assignmentId: 'manual-grade' })
    expect(await repositories.staffPermissionAssignments.list({ staffId: 'st1' })).toEqual([])
  })

  test('automatic grants enforce status, validity, year and revocation in real access policies', async () => {
    const { repositories, service, fixture } = await createProfileContext()
    const member = (await repositories.staffMembers.findById('st1'))!
    await repositories.staffMembers.save(new StaffMember({ ...member.data, subjectId: 'subject-ada' }))
    await repositories.academicYears.save(new AcademicYear(withShortName({ id: 'ay2', schoolId: 'sch1', name: 'Next', startDate: new Date('2027-01-01'), endDate: new Date('2027-12-31'), status: 'draft' })))
    const actor = createStaffActorMetadata({ subjectId: 'subject-ada', staffMemberId: 'st1', schoolId: 'sch1', academicYearId: 'ay1', requestId: 'proof', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Strong })
    const access = fixture.forActor(actor).baseService.access
    const input = { id: 'audit', schoolId: 'sch1', staffId: 'st1', academicYearId: 'ay1', permission: Permission.ACCESS_CONTROL_READ }
    for (const lifetime of [
      { status: 'inactive' as const },
      { status: 'expired' as const },
      { startsAt: new Date('2099-01-01') },
      { endsAt: new Date('2000-01-01') },
    ]) {
      await service.accessControlWorkflow.assignStaffPermission({ ...input, ...lifetime })
      await expect(access.assertSchool(Permission.ACCESS_CONTROL_READ)).rejects.toBeInstanceOf(AuthorizationError)
      await service.accessControlWorkflow.removeStaffPermission({ assignmentId: input.id })
    }
    await service.accessControlWorkflow.assignStaffPermission(input)
    await access.assertSchool(Permission.ACCESS_CONTROL_READ)
    await expect(access.assertSchool(Permission.ACCESS_CONTROL_MANAGE)).rejects.toBeInstanceOf(AuthorizationError)
    await expect(fixture.forActor({ ...actor, academicYearId: 'ay2' }).baseService.access.assertSchool(Permission.ACCESS_CONTROL_READ)).rejects.toBeInstanceOf(AuthorizationError)
    await expect(fixture.forActor({ ...actor, schoolId: 'another-school' }).baseService.access.assertSchool(Permission.ACCESS_CONTROL_READ)).rejects.toBeInstanceOf(AuthorizationError)
    await service.accessControlWorkflow.removeStaffPermission({ assignmentId: 'audit' })
    await expect(access.assertSchool(Permission.ACCESS_CONTROL_READ)).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('unscoped assignments cannot bypass held-authority delegation with an empty selection', async () => {
    const { repositories, admin } = await limitedAdministrator()
    for (const previewOnly of [true, false]) {
      await expect(admin.assignStaffPermission({ id: 'unauthorized-payment', schoolId: 'sch1', staffId: 'st1', academicYearId: 'ay1', permission: Permission.FINANCIAL_REPORT_READ, customScopes: [], previewOnly })).rejects.toBeInstanceOf(AuthorizationError)
    }
    expect(await repositories.staffManualPermissionAssignments.findById('unauthorized-payment')).toBeUndefined()
    expect(await repositories.staffPermissionAssignments.findById('mpg:unauthorized-payment')).toBeUndefined()
  })

  test('limited administrators revoke grading without redelegating unchanged payment access', async () => {
    const { repositories, service, admin } = await limitedAdministrator()
    const grading = { id: 'grading', schoolId: 'sch1', staffId: 'st1', academicYearId: 'ay1', permission: Permission.GRADE_MANAGE, customScopes: [{ kind: 'class_group' as const, classGroupId: 'class-a' }], useDefaultScopes: false }
    await service.accessControlWorkflow.assignStaffPermission(grading)
    await service.accessControlWorkflow.assignStaffPermission({ ...grading, id: 'payment', permission: Permission.FINANCIAL_REPORT_READ, customScopes: [] })
    const payment = (await repositories.staffPermissionAssignments.findById('mpg:payment'))!.data
    const preview = await admin.assignStaffPermission({ ...grading, customScopes: [], previewOnly: true })
    expect(preview.resolution.changes).toEqual([expect.objectContaining({ permission: Permission.GRADE_MANAGE, change: 'removed' })])
    expect(await repositories.staffPermissionAssignments.findById('mpg:grading')).toBeDefined()
    await admin.removeStaffPermission({ assignmentId: 'grading' })
    expect(await repositories.staffManualPermissionAssignments.findById('grading')).toBeUndefined()
    expect(await repositories.staffPermissionAssignments.findById('mpg:grading')).toBeUndefined()
    expect((await repositories.staffPermissionAssignments.findById('mpg:payment'))!.data).toEqual(payment)
  })

  test('unauthorized additions, expansion, and validity changes fail in preview and save atomically', async () => {
    const { repositories, service, admin } = await limitedAdministrator()
    const input = { id: 'm', schoolId: 'sch1', staffId: 'st1', academicYearId: 'ay1', permission: Permission.GRADE_MANAGE, customScopes: [{ kind: 'class_group' as const, classGroupId: 'class-a' }], useDefaultScopes: false, endsAt: new Date('2026-12-01') }
    await service.accessControlWorkflow.assignStaffPermission({ ...input, id: 'grade', staffId: 'limited' })
    await service.accessControlWorkflow.assignStaffPermission(input)
    const before = (await repositories.staffPermissionAssignments.findById('mpg:m'))!.data
    for (const change of [
      { permission: Permission.FINANCIAL_REPORT_READ, customScopes: [] },
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
    for (const id of ['first', 'fallback']) await service.accessControlWorkflow.configurePermissionProfile({ id, name: id, permissions: [Permission.GRADE_MANAGE] })
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
    await service.accessControlWorkflow.applyStaffPermissionProfile({ staffId: 'st1', profileId: 'p', academicYearId: 'ay1', customScopes: [], useDefaultScopes: false })
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
    const updated = { ...input, permission: Permission.GRADE_MANAGE }
    const preview = await service.accessControlWorkflow.assignStaffPermission({ ...updated, previewOnly: true })
    expect(preview.resolution.changes.map(row => [row.permission, row.change])).toEqual([[Permission.GRADE_READ, 'removed'], [Permission.GRADE_MANAGE, 'added']])
    expect((await repositories.staffPermissionAssignments.findById('mpg:m'))?.permission).toBe(Permission.GRADE_READ)
    await service.accessControlWorkflow.assignStaffPermission(updated)
    expect((await repositories.staffPermissionAssignments.findById('mpg:m'))?.permission).toBe(Permission.GRADE_MANAGE)
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
    await service.accessControlWorkflow.configurePermissionProfile({ id: 'mixed', name: 'Mixed', permissions: [Permission.FINANCIAL_REPORT_READ, Permission.GRADE_MANAGE, Permission.REPORT_CARD_CONFIGURE] })
    const binding = await service.accessControlWorkflow.applyStaffPermissionProfile({ staffId: 'st1', profileId: 'mixed', academicYearId: 'ay1', customScopes: [{ kind: 'class_group', classGroupId: 'class-a' }], useDefaultScopes: false })
    const grants = await repositories.staffPermissionAssignments.list({ staffId: 'st1' })
    expect(grants.map(row => row.permission).sort()).toEqual([Permission.FINANCIAL_REPORT_READ, Permission.GRADE_MANAGE].sort())
    expect(binding.resolution.warnings).toContainEqual(expect.objectContaining({ permission: Permission.REPORT_CARD_CONFIGURE, reason: 'missing_scope' }))
    expect((await repositories.staffPermissionProfileBindings.findById(binding.id))?.warnings).toEqual(binding.warnings)
  })

  test('default changes are additive and preserve custom profile and manual selections', async () => {
    const { repositories, service } = await createProfileContext()
    for (const id of ['class-b', 'class-c']) await repositories.classGroups.save(new ClassGroup(withShortName({ id, schoolId: 'sch1', academicYearId: 'ay1', gradeLevelId: 'grade-1', name: id })))
    await service.accessControlWorkflow.configurePermissionProfile({ id: 'p', name: 'Grades', permissions: [Permission.GRADE_MANAGE] })
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
    await service.accessControlWorkflow.configurePermissionProfile({ id: 'p', name: 'Grades', permissions: [Permission.GRADE_MANAGE] })
    await service.accessControlWorkflow.configureStaffPermissionScopeDefaults({ staffId: 'st1', academicYearId: 'ay1', scopes: [{ kind: 'class_group', classGroupId: 'class-a' }] })
    const binding = await service.accessControlWorkflow.applyStaffPermissionProfile({ staffId: 'st1', profileId: 'p', academicYearId: 'ay1', customScopes: [], useDefaultScopes: true })
    await service.accessControlWorkflow.assignStaffPermission({ id: 'm', schoolId: 'sch1', staffId: 'st1', academicYearId: 'ay1', permission: Permission.GRADE_READ, customScopes: [], useDefaultScopes: true })
    const result = await service.accessControlWorkflow.configureStaffPermissionScopeDefaults({ staffId: 'st1', academicYearId: 'ay1', scopes: [] })
    expect(result.resolution.changes.every(row => row.change === 'removed')).toBe(true)
    expect(await repositories.staffPermissionAssignments.list({ staffId: 'st1' })).toHaveLength(0)
    expect((await repositories.staffPermissionProfileBindings.findById(binding.id))?.warnings).toContainEqual({ permission: Permission.GRADE_MANAGE, reason: 'missing_scope' })
    expect(await repositories.staffManualPermissionAssignments.findById('m')).toBeDefined()
    await service.accessControlWorkflow.configureStaffPermissionScopeDefaults({ staffId: 'st1', academicYearId: 'ay1', scopes: [{ kind: 'class_group', classGroupId: 'class-a' }] })
    expect(await repositories.staffPermissionAssignments.list({ staffId: 'st1' })).toHaveLength(2)
    expect((await repositories.staffManualPermissionAssignments.findById('m'))?.warnings).toEqual([])
  })

  test('preview does not write and profile edits withdraw obsolete permissions', async () => {
    const { repositories, service } = await createProfileContext()
    await service.accessControlWorkflow.configurePermissionProfile({ id: 'p', name: 'Grades', permissions: [Permission.GRADE_MANAGE] })
    await service.accessControlWorkflow.applyStaffPermissionProfile({ staffId: 'st1', profileId: 'p', academicYearId: 'ay1', customScopes: [{ kind: 'class_group', classGroupId: 'class-a' }], useDefaultScopes: false })
    const preview = await service.accessControlWorkflow.configurePermissionProfile({ id: 'p', name: 'Exams', permissions: [Permission.REPORT_CARD_CONFIGURE], previewOnly: true })
    expect(preview.resolution.changes[0]?.change).toBe('removed')
    expect((await repositories.staffPermissionProfiles.findById('p'))?.name).toBe('Grades')
    expect(await repositories.staffPermissionAssignments.list({ staffId: 'st1' })).toHaveLength(1)
    await service.accessControlWorkflow.configurePermissionProfile({ id: 'p', name: 'Exams', permissions: [Permission.REPORT_CARD_CONFIGURE] })
    expect(await repositories.staffPermissionAssignments.list({ staffId: 'st1' })).toHaveLength(0)
    expect((await repositories.staffPermissionProfileBindings.list({ staffId: 'st1' }))[0]?.customScopes).toEqual([{ kind: 'class_group', classGroupId: 'class-a' }])
  })

  test('first profile owns a permission even when its scope cannot resolve', async () => {
    const { repositories, service } = await createProfileContext()
    for (const id of ['first', 'second']) await service.accessControlWorkflow.configurePermissionProfile({ id, name: id, permissions: [Permission.GRADE_MANAGE] })
    await service.accessControlWorkflow.applyStaffPermissionProfile({ staffId: 'st1', profileId: 'first', academicYearId: 'ay1', customScopes: [], useDefaultScopes: false })
    const second = await service.accessControlWorkflow.applyStaffPermissionProfile({ staffId: 'st1', profileId: 'second', academicYearId: 'ay1', customScopes: [{ kind: 'all', grain: 'class_group' }], useDefaultScopes: false })
    expect(await repositories.staffPermissionAssignments.list({ staffId: 'st1' })).toHaveLength(0)
    expect(second.warnings).toContainEqual({ permission: Permission.GRADE_MANAGE, reason: 'shadowed', ownerProfileId: 'first' })
    await service.accessControlWorkflow.reorderStaffPermissionProfiles({ staffId: 'st1', academicYearId: 'ay1', profileIds: ['second', 'first'] })
    expect((await repositories.staffPermissionAssignments.list({ staffId: 'st1' }))[0]?.sourceProfileId).toBe('second')
    await service.accessControlWorkflow.removeStaffPermissionProfile({ staffId: 'st1', academicYearId: 'ay1', profileId: 'second' })
    expect(await repositories.staffPermissionAssignments.list({ staffId: 'st1' })).toHaveLength(0)
  })

  test('the same profile can be assigned in separate years and default updates are isolated', async () => {
    const { repositories, service } = await createProfileContext()
    await repositories.academicYears.save(new AcademicYear(withShortName({ id: 'ay2', schoolId: 'sch1', name: 'Next', startDate: new Date('2027-01-01'), endDate: new Date('2027-12-31'), status: 'draft' })))
    await service.accessControlWorkflow.configurePermissionProfile({ id: 'p', name: 'Read', permissions: [Permission.GRADE_READ] })
    for (const year of ['ay1', 'ay2']) {
      await service.accessControlWorkflow.configureStaffPermissionScopeDefaults({ staffId: 'st1', academicYearId: year, scopes: [{ kind: 'all', grain: 'class_group' }] })
      await service.accessControlWorkflow.applyStaffPermissionProfile({ staffId: 'st1', profileId: 'p', academicYearId: year, customScopes: [], useDefaultScopes: true })
    }
    await service.accessControlWorkflow.configureStaffPermissionScopeDefaults({ staffId: 'st1', academicYearId: 'ay1', scopes: [] })
    expect(await repositories.staffPermissionAssignments.list({ staffId: 'st1', academicYearId: 'ay1' })).toHaveLength(0)
    expect(await repositories.staffPermissionAssignments.list({ staffId: 'st1', academicYearId: 'ay2' })).toHaveLength(1)
  })

  test('catalog deletion freezes unique grants as explicit manual assignments', async () => {
    const { repositories, service } = await createProfileContext()
    await service.accessControlWorkflow.configurePermissionProfile({ id: 'p', name: 'Read', permissions: [Permission.STAFF_READ] })
    await service.accessControlWorkflow.applyStaffPermissionProfile({ staffId: 'st1', profileId: 'p', academicYearId: 'ay1', customScopes: [], useDefaultScopes: false })
    await service.baseService.entities.staffPermissionProfiles.delete('p')
    const grants = await repositories.staffPermissionAssignments.list({ staffId: 'st1' })
    expect(grants).toHaveLength(1)
    expect(grants[0]?.sourceProfileId).toBeUndefined()
    expect(grants[0]?.sourceManualAssignmentId).toBeDefined()
    expect((await repositories.staffManualPermissionAssignments.list({ staffId: 'st1' }))[0]?.useDefaultScopes).toBe(false)
  })

  test('catalog deletion preserves unique access independently in each year', async () => {
    const { repositories, service } = await createProfileContext()
    await repositories.academicYears.save(new AcademicYear(withShortName({ id: 'ay2', schoolId: 'sch1', name: 'Next', startDate: new Date('2027-01-01'), endDate: new Date('2027-12-31'), status: 'draft' })))
    for (const id of ['p', 'next']) await service.accessControlWorkflow.configurePermissionProfile({ id, name: id, permissions: [Permission.STAFF_READ] })
    await service.accessControlWorkflow.applyStaffPermissionProfile({ staffId: 'st1', profileId: 'p', academicYearId: 'ay1', customScopes: [], useDefaultScopes: false })
    await service.accessControlWorkflow.applyStaffPermissionProfile({ staffId: 'st1', profileId: 'next', academicYearId: 'ay2', customScopes: [], useDefaultScopes: false })
    await service.baseService.entities.staffPermissionProfiles.delete('p')
    expect(await repositories.staffPermissionAssignments.list({ staffId: 'st1', academicYearId: 'ay1' })).toHaveLength(1)
    expect(await repositories.staffPermissionAssignments.list({ staffId: 'st1', academicYearId: 'ay2' })).toHaveLength(1)
  })

  test('missing saved targets remove generated grants but keep the repairable source', async () => {
    const { repositories, service } = await createProfileContext()
    await service.accessControlWorkflow.configurePermissionProfile({ id: 'p', name: 'Grades', permissions: [Permission.GRADE_MANAGE] })
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
    await repositories.academicYears.save(new AcademicYear(withShortName({ id: 'ay2', schoolId: 'sch1', name: 'Next', startDate: new Date('2027-01-01'), endDate: new Date('2027-12-31'), status: 'draft' })))
    await expect(service.accessControlWorkflow.configureStaffPermissionScopeDefaults({ staffId: 'st1', academicYearId: 'ay2', scopes: [{ kind: 'class_group', classGroupId: 'class-a' }] })).rejects.toThrow('Scope target')
    expect(await repositories.staffPermissionScopeDefaults.list({ staffId: 'st1' })).toHaveLength(0)
  })

  test('delegation denial rolls back defaults and generated grants', async () => {
    const { repositories, service, fixture } = await createProfileContext()
    await repositories.staffMembers.save(new StaffMember({ id: 'limited', schoolId: 'sch1', firstName: 'Limited', lastName: 'Admin', subjectId: 'subject-limited' }))
    await service.accessControlWorkflow.assignStaffPermission({ id: 'limited-assign', schoolId: 'sch1', staffId: 'limited', academicYearId: 'ay1', permission: Permission.ACCESS_CONTROL_MANAGE, customScopes: [], useDefaultScopes: false })
    await service.accessControlWorkflow.configurePermissionProfile({ id: 'p', name: 'Grades', permissions: [Permission.GRADE_MANAGE] })
    await service.accessControlWorkflow.applyStaffPermissionProfile({ staffId: 'st1', profileId: 'p', academicYearId: 'ay1', customScopes: [], useDefaultScopes: true })
    const limited = fixture.forActor(createStaffActorMetadata({ subjectId: 'subject-limited', staffMemberId: 'limited', schoolId: 'sch1', requestId: 'request', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Strong }))
    await expect(limited.accessControlWorkflow.configureStaffPermissionScopeDefaults({ staffId: 'st1', academicYearId: 'ay1', scopes: [{ kind: 'all', grain: 'class_group' }] })).rejects.toBeInstanceOf(AuthorizationError)
    expect(await repositories.staffPermissionScopeDefaults.list({ staffId: 'st1' })).toHaveLength(0)
    expect(await repositories.staffPermissionAssignments.list({ staffId: 'st1' })).toHaveLength(0)
  })
})
