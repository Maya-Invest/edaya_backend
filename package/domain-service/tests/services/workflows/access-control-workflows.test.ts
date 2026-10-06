import type { BusinessRuleViolationError } from '@edaya/core'
import { AuthorizationError } from '@edaya/authorization'
import { AcademicYear, Guardian, noOpNotificationGateway, Permission, StaffMember, StaffPermissionAssignment, Student, StudentStatus } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { createTestApp } from '../../support/create-test-app'
import { createTestStaffActor } from '../../support/test-actor'

async function createAccessControlContext(permissions: readonly Permission[] = [Permission.ACCESS_CONTROL_ASSIGN, Permission.ACCESS_CONTROL_READ], notificationGateway = noOpNotificationGateway) {
  const fixture = await createTestApp(createTestStaffActor('sch1', 'staff-admin'), { notificationGateway })
  const repositories = fixture.schoolRepositories
  await repositories.academicYears.save(new AcademicYear({ id: 'ay1', schoolId: 'sch1', name: 'Year', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), status: 'published' }))
  for (const permission of permissions) await repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: permission, schoolId: 'sch1', academicYearId: 'ay1', staffId: 'staff-admin', permission, scopes: [{ kind: 'school' }] }))
  await repositories.staffMembers.save(new StaffMember({ id: 'st1', schoolId: 'sch1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@school.edu' }))
  await repositories.guardians.save(new Guardian({ id: 'g1', schoolId: 'sch1', firstName: 'Grace', lastName: 'Hopper', email: 'grace@mail.com', phone: '+33 6 00 00 00 00' }))
  await repositories.students.save(new Student({ id: 's1', schoolId: 'sch1', firstName: 'Alan', lastName: 'Turing', status: StudentStatus.Active }))
  return { repositories, service: fixture.app }
}

describe('SchoolService access-control workflows', () => {
  test('linkActorSubject links a staff member when caller has ACCESS_CONTROL_ASSIGN', async () => {
    const { repositories, service } = await createAccessControlContext()

    const result = await service.accessControlWorkflow.linkActorSubject({
      subjectId: 'auth-user-1',
      staffMemberId: 'st1',
    })

    expect(result.kind).toBe('staff')
    expect(result.entity.subjectId).toBe('auth-user-1')
    expect((await repositories.staffMembers.findById('st1'))?.subjectId).toBe(result.entity.subjectId)
  })

  test('linkActorSubject rejects callers without ACCESS_CONTROL_ASSIGN', async () => {
    const { service } = await createAccessControlContext(
      [Permission.ACCESS_CONTROL_READ],
    )

    await expect(service.accessControlWorkflow.linkActorSubject({
      subjectId: 'auth-user-1',
      staffMemberId: 'st1',
    })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('linkActorSubject rejects ambiguous targets', async () => {
    const { service } = await createAccessControlContext()

    await expect(service.accessControlWorkflow.linkActorSubject({
      subjectId: 'auth-user-1',
      staffMemberId: 'st1',
      guardianId: 'g1',
    })).rejects.toMatchObject({
      code: 'LINK_ACTOR_SUBJECT_AMBIGUOUS',
    } satisfies Partial<BusinessRuleViolationError>)
  })

  test('linkActorSubject allows the same subject on staff when a guardian already uses it in the school', async () => {
    const { repositories, service } = await createAccessControlContext()
    await repositories.guardians.save(new Guardian({
      id: 'g-other',
      schoolId: 'sch1',
      firstName: 'Other',
      lastName: 'Guardian',
      subjectId: 'auth-user-1',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    }))

    const result = await service.accessControlWorkflow.linkActorSubject({
      subjectId: 'auth-user-1',
      staffMemberId: 'st1',
    })

    expect(result.kind).toBe('staff')
    expect(result.entity.subjectId).toBe('auth-user-1')
    expect((await repositories.staffMembers.findById('st1'))?.subjectId).toBe(result.entity.subjectId)
  })

  test('linkActorSubject rejects duplicate staff subject ids in the same school', async () => {
    const { repositories, service } = await createAccessControlContext()
    await repositories.staffMembers.save(new StaffMember({
      id: 'st-other',
      schoolId: 'sch1',
      firstName: 'Other',
      lastName: 'Staff',
      subjectId: 'auth-user-1',
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    }))

    await expect(service.accessControlWorkflow.linkActorSubject({
      subjectId: 'auth-user-1',
      staffMemberId: 'st1',
    })).rejects.toMatchObject({
      code: 'SUBJECT_ID_ALREADY_LINKED',
    } satisfies Partial<BusinessRuleViolationError>)
  })

  test('linkActorSubject is idempotent when the same subject is already linked', async () => {
    const { repositories, service } = await createAccessControlContext()
    await repositories.staffMembers.save(new StaffMember({
      id: 'st1',
      schoolId: 'sch1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      subjectId: 'auth-user-1',
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    }))

    const result = await service.accessControlWorkflow.linkActorSubject({
      subjectId: 'auth-user-1',
      staffMemberId: 'st1',
    })

    expect(result.entity.subjectId).toBe('auth-user-1')
    expect((await repositories.staffMembers.findById('st1'))?.subjectId).toBe(result.entity.subjectId)
  })

  test('linkActorSubject rejects replacing an existing entity subject', async () => {
    const { repositories, service } = await createAccessControlContext()
    await repositories.staffMembers.save(new StaffMember({
      id: 'st1',
      schoolId: 'sch1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      subjectId: 'auth-user-old',
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    }))

    await expect(service.accessControlWorkflow.linkActorSubject({
      subjectId: 'auth-user-new',
      staffMemberId: 'st1',
    })).rejects.toMatchObject({
      code: 'ACTOR_SUBJECT_ALREADY_LINKED',
    } satisfies Partial<BusinessRuleViolationError>)
    expect((await repositories.staffMembers.findById('st1'))?.subjectId).toBe('auth-user-old')
  })

  test('unlinkActorSubject clears the auth subject from a linked staff member', async () => {
    const { repositories, service } = await createAccessControlContext()
    await repositories.staffMembers.save(new StaffMember({
      id: 'st1',
      schoolId: 'sch1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      subjectId: 'auth-user-1',
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    }))

    const result = await service.accessControlWorkflow.unlinkActorSubject({
      staffMemberId: 'st1',
    })

    expect(result.entity.subjectId).toBeUndefined()
    expect((await repositories.staffMembers.findById('st1'))?.subjectId).toBe(result.entity.subjectId)
  })

  test('assignStaffPermission persists permission assignments for the school', async () => {
    const { repositories, service } = await createAccessControlContext()

    const assignment = await service.accessControlWorkflow.assignStaffPermission({
      id: 'spa1',
      staffId: 'st1',
      schoolId: 'sch1',
      academicYearId: 'ay1',
      permission: Permission.ACCESS_CONTROL_READ,
      customScopes: [{ kind: 'school' }],
    })

    expect(assignment.permission).toBe(Permission.ACCESS_CONTROL_READ)
    expect((await repositories.staffManualPermissionAssignments.findById('spa1'))?.permission).toBe(assignment.permission)
    expect((await repositories.staffPermissionAssignments.findById('mpg:spa1'))?.permission).toBe(assignment.permission)
  })

  test('relinkActorSubject replaces an existing auth subject', async () => {
    const { repositories, service } = await createAccessControlContext()
    await repositories.staffMembers.save(new StaffMember({
      id: 'st1',
      schoolId: 'sch1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      subjectId: 'auth-user-old',
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    }))

    const result = await service.accessControlWorkflow.relinkActorSubject({
      subjectId: 'auth-user-1',
      staffMemberId: 'st1',
    })

    expect(result.entity.subjectId).toBe('auth-user-1')
    expect((await repositories.staffMembers.findById('st1'))?.subjectId).toBe('auth-user-1')
  })

  test('unlinkActorSubject rejects ambiguous targets', async () => {
    const { service } = await createAccessControlContext()

    await expect(service.accessControlWorkflow.unlinkActorSubject({
      staffMemberId: 'st1',
      guardianId: 'g1',
    })).rejects.toMatchObject({
      code: 'LINK_ACTOR_SUBJECT_AMBIGUOUS',
    } satisfies Partial<BusinessRuleViolationError>)
  })

  test('linkActorSubject links a guardian when caller has ACCESS_CONTROL_ASSIGN', async () => {
    const { repositories, service } = await createAccessControlContext()

    const result = await service.accessControlWorkflow.linkActorSubject({
      subjectId: 'auth-guardian-1',
      guardianId: 'g1',
    })

    expect(result.kind).toBe('guardian')
    expect(result.entity.subjectId).toBe('auth-guardian-1')
    expect((await repositories.guardians.findById('g1'))?.subjectId).toBe('auth-guardian-1')
  })
})
