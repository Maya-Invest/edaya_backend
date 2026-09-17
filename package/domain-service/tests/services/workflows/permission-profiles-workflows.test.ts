import { ActorAssuranceLevel, AuthorizationError, createStaffActorMetadata } from '@edaya/authorization'
import { AcademicYear, ClassGroup, GradeLevel, Permission, StaffMember } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { profileBoundGrantId } from '../../../src/capabilities/access-control/profile-bound-grant-id'
import { splitInvitePresetIntoProfiles } from '../../../src/capabilities/access-control/seed-staff-permission-profiles'
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

describe('permission profile workflows', () => {
  test('splitInvitePresetIntoProfiles keeps a single grain per fragment', () => {
    const coordinator = STAFF_INVITE_PERMISSION_PRESETS.find(preset => preset.id === 'role-coordinator')!
    const fragments = splitInvitePresetIntoProfiles(coordinator)
    expect(fragments.some(fragment => fragment.sourceKey === 'role-coordinator')).toBe(true)
    expect(fragments.some(fragment => fragment.sourceKey === 'role-coordinator:class_group')).toBe(true)
    expect(fragments.every(fragment => fragment.permissions.every((permission) => {
      if (fragment.scopeGrain === 'school')
        return permission !== Permission.GRADE_INPUT
      if (fragment.scopeGrain === 'class_group')
        return permission !== Permission.PAYMENT_READ
      return true
    }))).toBe(true)
  })

  test('rejects mixed-grain profile configuration', async () => {
    const { service } = await createProfileContext()
    await expect(service.accessControlWorkflow.configurePermissionProfile({
      id: 'mixed',
      schoolId: 'sch1',
      name: 'Mixed',
      scopeGrain: 'school',
      permissions: [Permission.PAYMENT_READ, Permission.GRADE_INPUT],
    })).rejects.toMatchObject({ code: 'PERMISSION_PROFILE_MIXED_GRAIN' })
  })

  test('locks grain while assigned and allows grain change when unassigned', async () => {
    const { service } = await createProfileContext()
    await service.accessControlWorkflow.configurePermissionProfile({
      id: 'profile-a',
      schoolId: 'sch1',
      name: 'Reads',
      scopeGrain: 'school',
      permissions: [Permission.ACCESS_CONTROL_READ],
    })
    await service.accessControlWorkflow.applyStaffPermissionProfile({
      staffId: 'st1',
      profileId: 'profile-a',
      academicYearId: 'ay1',
      scopes: [{ kind: 'school' }],
    })
    await expect(service.accessControlWorkflow.configurePermissionProfile({
      id: 'profile-a',
      schoolId: 'sch1',
      name: 'Reads',
      scopeGrain: 'class_group',
      permissions: [Permission.GRADE_INPUT],
    })).rejects.toMatchObject({ code: 'PERMISSION_PROFILE_SCOPE_LOCKED' })

    await service.accessControlWorkflow.removeStaffPermissionProfile({ staffId: 'st1', profileId: 'profile-a' })
    const updated = await service.accessControlWorkflow.configurePermissionProfile({
      id: 'profile-a',
      schoolId: 'sch1',
      name: 'Classes',
      scopeGrain: 'class_group',
      permissions: [Permission.GRADE_INPUT, Permission.PAYMENT_READ],
    })
    expect(updated.scopeGrain).toBe('class_group')
    expect(updated.permissions).toEqual([Permission.GRADE_INPUT])
  })

  test('first-wins skips a later duplicate permission even with different scopes', async () => {
    const { repositories, service } = await createProfileContext()
    await service.accessControlWorkflow.configurePermissionProfile({
      id: 'first',
      schoolId: 'sch1',
      name: 'First',
      scopeGrain: 'class_group',
      permissions: [Permission.GRADE_INPUT],
    })
    await service.accessControlWorkflow.configurePermissionProfile({
      id: 'second',
      schoolId: 'sch1',
      name: 'Second',
      scopeGrain: 'class_group',
      permissions: [Permission.GRADE_INPUT, Permission.GRADE_READ],
    })
    await service.accessControlWorkflow.applyStaffPermissionProfile({
      staffId: 'st1',
      profileId: 'first',
      academicYearId: 'ay1',
      scopes: [{ kind: 'class_group', classGroupId: 'class-a' }],
    })
    await service.accessControlWorkflow.applyStaffPermissionProfile({
      staffId: 'st1',
      profileId: 'second',
      academicYearId: 'ay1',
      scopes: [{ kind: 'all', grain: 'class_group' }],
    })

    const grants = await repositories.staffPermissionAssignments.list({ staffId: 'st1' })
    const input = grants.find(grant => grant.permission === Permission.GRADE_INPUT)
    expect(input?.sourceProfileId).toBe('first')
    expect(input?.scopes).toEqual([{ kind: 'class_group', classGroupId: 'class-a' }])
    expect(grants.find(grant => grant.permission === Permission.GRADE_READ)?.sourceProfileId).toBe('second')
  })

  test('reorder transfers ownership and removing rank 0 lets rank 1 apply', async () => {
    const { repositories, service } = await createProfileContext()
    await service.accessControlWorkflow.configurePermissionProfile({
      id: 'first',
      schoolId: 'sch1',
      name: 'First',
      scopeGrain: 'school',
      permissions: [Permission.ACCESS_CONTROL_READ],
    })
    await service.accessControlWorkflow.configurePermissionProfile({
      id: 'second',
      schoolId: 'sch1',
      name: 'Second',
      scopeGrain: 'school',
      permissions: [Permission.ACCESS_CONTROL_READ],
    })
    await service.accessControlWorkflow.applyStaffPermissionProfile({
      staffId: 'st1',
      profileId: 'first',
      academicYearId: 'ay1',
      scopes: [{ kind: 'school' }],
    })
    await service.accessControlWorkflow.applyStaffPermissionProfile({
      staffId: 'st1',
      profileId: 'second',
      academicYearId: 'ay1',
      scopes: [{ kind: 'school' }],
    })
    expect((await repositories.staffPermissionAssignments.findById(profileBoundGrantId('st1', 'first', Permission.ACCESS_CONTROL_READ)))?.sourceProfileId).toBe('first')

    await service.accessControlWorkflow.reorderStaffPermissionProfiles({
      staffId: 'st1',
      profileIds: ['second', 'first'],
    })
    expect((await repositories.staffPermissionAssignments.findById(profileBoundGrantId('st1', 'second', Permission.ACCESS_CONTROL_READ)))?.sourceProfileId).toBe('second')
    expect(await repositories.staffPermissionAssignments.findById(profileBoundGrantId('st1', 'first', Permission.ACCESS_CONTROL_READ))).toBeUndefined()

    await service.accessControlWorkflow.removeStaffPermissionProfile({ staffId: 'st1', profileId: 'second' })
    expect((await repositories.staffPermissionAssignments.findById(profileBoundGrantId('st1', 'first', Permission.ACCESS_CONTROL_READ)))?.sourceProfileId).toBe('first')
  })

  test('live-sync dropping a permission frees it for later profiles and leaves custom grants', async () => {
    const { repositories, service } = await createProfileContext()
    await service.accessControlWorkflow.configurePermissionProfile({
      id: 'first',
      schoolId: 'sch1',
      name: 'First',
      scopeGrain: 'school',
      permissions: [Permission.ACCESS_CONTROL_READ, Permission.STAFF_READ],
    })
    await service.accessControlWorkflow.configurePermissionProfile({
      id: 'second',
      schoolId: 'sch1',
      name: 'Second',
      scopeGrain: 'school',
      permissions: [Permission.ACCESS_CONTROL_READ],
    })
    await service.accessControlWorkflow.applyStaffPermissionProfile({
      staffId: 'st1',
      profileId: 'first',
      academicYearId: 'ay1',
      scopes: [{ kind: 'school' }],
    })
    await service.accessControlWorkflow.applyStaffPermissionProfile({
      staffId: 'st1',
      profileId: 'second',
      academicYearId: 'ay1',
      scopes: [{ kind: 'school' }],
    })
    await service.accessControlWorkflow.assignStaffPermission({
      id: 'custom',
      staffId: 'st1',
      schoolId: 'sch1',
      academicYearId: 'ay1',
      permission: Permission.PAYMENT_READ,
      scopes: [{ kind: 'school' }],
    })

    await service.accessControlWorkflow.configurePermissionProfile({
      id: 'first',
      schoolId: 'sch1',
      name: 'First',
      scopeGrain: 'school',
      permissions: [Permission.STAFF_READ],
    })

    expect((await repositories.staffPermissionAssignments.findById(profileBoundGrantId('st1', 'second', Permission.ACCESS_CONTROL_READ)))?.sourceProfileId).toBe('second')
    expect((await repositories.staffPermissionAssignments.findById('custom'))?.permission).toBe(Permission.PAYMENT_READ)
  })

  test('rejects a custom grant that duplicates a bound permission and equivalent scopes', async () => {
    const { service } = await createProfileContext()
    await service.accessControlWorkflow.configurePermissionProfile({
      id: 'first',
      schoolId: 'sch1',
      name: 'First',
      scopeGrain: 'school',
      permissions: [Permission.ACCESS_CONTROL_READ],
    })
    await service.accessControlWorkflow.applyStaffPermissionProfile({
      staffId: 'st1',
      profileId: 'first',
      academicYearId: 'ay1',
      scopes: [{ kind: 'school' }],
    })
    await expect(service.accessControlWorkflow.assignStaffPermission({
      id: 'dup',
      staffId: 'st1',
      schoolId: 'sch1',
      academicYearId: 'ay1',
      permission: Permission.ACCESS_CONTROL_READ,
      scopes: [{ kind: 'school' }],
    })).rejects.toMatchObject({ code: 'PROFILE_GRANT_DUPLICATE' })
  })

  test('catalog delete freezes unique permissions as custom and re-resolves the rest', async () => {
    const { repositories, service } = await createProfileContext()
    await service.accessControlWorkflow.configurePermissionProfile({
      id: 'first',
      schoolId: 'sch1',
      name: 'First',
      scopeGrain: 'school',
      permissions: [Permission.ACCESS_CONTROL_READ, Permission.STAFF_READ],
    })
    await service.accessControlWorkflow.configurePermissionProfile({
      id: 'second',
      schoolId: 'sch1',
      name: 'Second',
      scopeGrain: 'school',
      permissions: [Permission.ACCESS_CONTROL_READ],
    })
    await service.accessControlWorkflow.applyStaffPermissionProfile({
      staffId: 'st1',
      profileId: 'first',
      academicYearId: 'ay1',
      scopes: [{ kind: 'school' }],
    })
    await service.accessControlWorkflow.applyStaffPermissionProfile({
      staffId: 'st1',
      profileId: 'second',
      academicYearId: 'ay1',
      scopes: [{ kind: 'school' }],
    })

    await service.baseService.entities.staffPermissionProfiles.delete('first')

    const grants = await repositories.staffPermissionAssignments.list({ staffId: 'st1' })
    const staffRead = grants.find(grant => grant.permission === Permission.STAFF_READ)
    expect(staffRead?.sourceProfileId).toBeUndefined()
    expect(grants.find(grant => grant.permission === Permission.ACCESS_CONTROL_READ)?.sourceProfileId).toBe('second')
  })

  test('stamped grants are not editable through assignStaffPermission', async () => {
    const { service } = await createProfileContext()
    await service.accessControlWorkflow.configurePermissionProfile({
      id: 'first',
      schoolId: 'sch1',
      name: 'First',
      scopeGrain: 'school',
      permissions: [Permission.ACCESS_CONTROL_READ],
    })
    await service.accessControlWorkflow.applyStaffPermissionProfile({
      staffId: 'st1',
      profileId: 'first',
      academicYearId: 'ay1',
      scopes: [{ kind: 'school' }],
    })
    await expect(service.accessControlWorkflow.assignStaffPermission({
      id: profileBoundGrantId('st1', 'first', Permission.ACCESS_CONTROL_READ),
      staffId: 'st1',
      schoolId: 'sch1',
      academicYearId: 'ay1',
      permission: Permission.STAFF_READ,
      scopes: [{ kind: 'school' }],
    })).rejects.toMatchObject({ code: 'PROFILE_BOUND_GRANT_LOCKED' })
  })

  test('delegation denial rolls back configure', async () => {
    const { repositories, service, fixture } = await createProfileContext()
    await service.accessControlWorkflow.configurePermissionProfile({
      id: 'first',
      schoolId: 'sch1',
      name: 'First',
      scopeGrain: 'class_group',
      permissions: [Permission.GRADE_INPUT],
    })
    await service.accessControlWorkflow.applyStaffPermissionProfile({
      staffId: 'st1',
      profileId: 'first',
      academicYearId: 'ay1',
      scopes: [{ kind: 'class_group', classGroupId: 'class-a' }],
    })
    await repositories.staffMembers.save(new StaffMember({
      id: 'staff-limited',
      schoolId: 'sch1',
      firstName: 'Limited',
      lastName: 'Admin',
      email: 'limited@school.edu',
      subjectId: 'subject-limited',
    }))
    await service.accessControlWorkflow.assignStaffPermission({
      id: 'limited-configure',
      staffId: 'staff-limited',
      schoolId: 'sch1',
      academicYearId: 'ay1',
      permission: Permission.ACCESS_CONTROL_CONFIGURE,
      scopes: [{ kind: 'school' }],
    })

    const limited = fixture.forActor(createStaffActorMetadata({
      subjectId: 'subject-limited',
      staffMemberId: 'staff-limited',
      schoolId: 'sch1',
      requestId: 'request',
      authenticatedAt: new Date('2026-01-01T00:00:00Z'),
      assuranceLevel: ActorAssuranceLevel.Strong,
    }))
    await expect(limited.accessControlWorkflow.configurePermissionProfile({
      id: 'first',
      schoolId: 'sch1',
      name: 'Renamed',
      scopeGrain: 'class_group',
      permissions: [Permission.GRADE_INPUT],
    })).rejects.toBeInstanceOf(AuthorizationError)

    const profile = await repositories.staffPermissionProfiles.findById('first')
    expect(profile?.name).toBe('First')
    expect((await repositories.staffPermissionAssignments.findById(profileBoundGrantId('st1', 'first', Permission.GRADE_INPUT)))?.sourceProfileId).toBe('first')
  })
})
