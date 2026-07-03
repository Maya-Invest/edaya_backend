import type { SchoolRepositories } from '../../../src/ports'
import { describe, expect, mock, test } from 'bun:test'
import {
  AuthorizationError,
  ELEVATED_STAFF_PERMISSIONS,
  Permission,
  resolveEffectiveGrants,
  scopeGrantCovers,
} from '../../../src/capabilities/authorization'
import { School, StaffMember, StaffPermissionAssignment } from '../../../src/domain'

const ACADEMIC_YEAR_ID = 'year-1'

interface PermissionListFilter {
  staffId?: string
  schoolId?: string
  academicYearId?: string
  status?: string
}

function createRepos(assignments: unknown[] = [], ownerSubjectId?: string, staffSubjectId?: string): SchoolRepositories {
  const permissionStore = new Map<string, StaffPermissionAssignment>()

  return {
    schools: {
      findById: mock(async () => new School({
        id: 'school-1',
        name: 'School',
        timeZone: 'UTC',
        ownerSubjectId,
      })),
    },
    staffMembers: {
      findById: mock(async () => ({
        id: 'staff-1',
        schoolId: 'school-1',
        subjectId: staffSubjectId,
        isActive: true,
      })),
    },
    staffAssignments: {
      list: mock(async () => assignments),
    },
    staffPermissionAssignments: {
      list: mock(async (filter: PermissionListFilter = {}) => [...permissionStore.values()].filter((row) => {
        if (filter.staffId && filter.staffId !== row.staffId) {
          return false
        }
        if (filter.schoolId && filter.schoolId !== row.schoolId) {
          return false
        }
        if (filter.academicYearId && filter.academicYearId !== row.academicYearId) {
          return false
        }
        if (filter.status && filter.status !== row.status) {
          return false
        }
        return true
      })),
      save: mock(async (entity: StaffPermissionAssignment) => {
        permissionStore.set(entity.id, entity)
      }),
    },
  } as unknown as SchoolRepositories
}

async function savePermission(
  repositories: SchoolRepositories,
  input: {
    id: string
    permission: Permission
    scopeIds?: string
    startsAt?: Date
    endsAt?: Date
  },
): Promise<void> {
  await repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({
    id: input.id,
    staffId: 'staff-1',
    schoolId: 'school-1',
    academicYearId: ACADEMIC_YEAR_ID,
    permission: input.permission,
    scopeIds: input.scopeIds ?? '',
    status: 'active',
    ...(input.startsAt ? { startsAt: input.startsAt } : {}),
    ...(input.endsAt ? { endsAt: input.endsAt } : {}),
  }))
}

describe('resolveEffectiveGrants', () => {
  test('grants school owner full school-scoped access without role assignments', async () => {
    const repositories = createRepos([], 'subject-owner', 'subject-owner')

    const grants = await resolveEffectiveGrants({
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      academicYearId: ACADEMIC_YEAR_ID,
      repositories,
    })

    expect(grants.isElevated).toBe(true)
    expect(grants.permissions.has(Permission.SCHOOL_LIFECYCLE_MANAGE)).toBe(true)
    expect(grants.permissions.has(Permission.PLATFORM_REGISTER_SCHOOL)).toBe(false)
    expect(grants.permissions.size).toBe(ELEVATED_STAFF_PERMISSIONS.length)
  })

  test('grants elevated access to owner-level service accounts', async () => {
    const repositories = createRepos()
    repositories.staffMembers.findById = mock(async () => new StaffMember({
      id: 'staff-service-1',
      schoolId: 'school-1',
      firstName: 'Seeding',
      lastName: 'Integration',
      accountKind: 'service',
      serviceId: 'seeding',
      serviceElevated: true,
      isActive: true,
    }))

    const grants = await resolveEffectiveGrants({
      staffMemberId: 'staff-service-1',
      schoolId: 'school-1',
      academicYearId: ACADEMIC_YEAR_ID,
      repositories,
    })

    expect(grants.isElevated).toBe(true)
    expect(grants.permissions.has(Permission.STUDENT_CREATE)).toBe(true)
    expect(grants.permissions.has(Permission.PLATFORM_REGISTER_SCHOOL)).toBe(false)
  })

  test('grants staff permissions with school scope', async () => {
    const repositories = createRepos()
    await savePermission(repositories, {
      id: 'spa-payment-record',
      permission: Permission.PAYMENT_RECORD,
    })

    const grants = await resolveEffectiveGrants({
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      academicYearId: ACADEMIC_YEAR_ID,
      repositories,
    })

    expect(grants.isElevated).toBe(false)
    expect(grants.permissions.has(Permission.PAYMENT_RECORD)).toBe(true)
    expect(scopeGrantCovers(grants, {
      permission: Permission.PAYMENT_RECORD,
      schoolId: 'school-1',
      scopeType: 'school',
      scopeEntityId: 'school-1',
      isElevated: grants.isElevated,
    })).toBe(true)
  })

  test('grants teacher assignment-scoped permissions from permission rows', async () => {
    const repositories = createRepos([
      { id: 'a-1', staffId: 'staff-1', classGroupId: 'class-1' },
    ])
    await savePermission(repositories, {
      id: 'spa-attendance-record',
      permission: Permission.ATTENDANCE_RECORD,
      scopeIds: 'class-1:subject-1',
    })

    const grants = await resolveEffectiveGrants({
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      academicYearId: ACADEMIC_YEAR_ID,
      repositories,
    })

    expect(grants.permissions.has(Permission.ATTENDANCE_RECORD)).toBe(true)
    expect(scopeGrantCovers(grants, {
      permission: Permission.ATTENDANCE_RECORD,
      schoolId: 'school-1',
      scopeType: 'class_subject',
      scopeEntityId: 'subject-1',
      isElevated: grants.isElevated,
    })).toBe(true)
    expect(scopeGrantCovers(grants, {
      permission: Permission.ATTENDANCE_RECORD,
      schoolId: 'school-1',
      scopeType: 'class_subject',
      scopeEntityId: 'subject-2',
      isElevated: grants.isElevated,
    })).toBe(false)
  })

  test('does not grant finance permissions to teachers', async () => {
    const repositories = createRepos()
    await savePermission(repositories, {
      id: 'spa-attendance-record',
      permission: Permission.ATTENDANCE_RECORD,
      scopeIds: 'class-1:subject-1',
    })

    const grants = await resolveEffectiveGrants({
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      academicYearId: ACADEMIC_YEAR_ID,
      repositories,
    })

    expect(grants.permissions.has(Permission.PAYMENT_RECORD)).toBe(false)
  })

  test('grants split payment permissions to accountants', async () => {
    const repositories = createRepos()
    for (const [index, permission] of [
      Permission.PAYMENT_RECORD,
      Permission.PAYMENT_CANCEL,
      Permission.PAYMENT_REVERSE,
      Permission.FINANCIAL_CONFIG_READ,
      Permission.FINANCIAL_CONFIG_CONFIGURE,
      Permission.FINANCIAL_CONFIG_UPDATE,
    ].entries()) {
      await savePermission(repositories, {
        id: `spa-accountant-${index}`,
        permission,
      })
    }

    const grants = await resolveEffectiveGrants({
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      academicYearId: ACADEMIC_YEAR_ID,
      repositories,
    })

    expect(grants.permissions.has(Permission.PAYMENT_RECORD)).toBe(true)
    expect(grants.permissions.has(Permission.PAYMENT_CANCEL)).toBe(true)
    expect(grants.permissions.has(Permission.PAYMENT_REVERSE)).toBe(true)
    expect(grants.permissions.has(Permission.FINANCIAL_CONFIG_READ)).toBe(true)
    expect(grants.permissions.has(Permission.FINANCIAL_CONFIG_CONFIGURE)).toBe(true)
    expect(grants.permissions.has(Permission.FINANCIAL_CONFIG_UPDATE)).toBe(true)
  })

  test('ignores active assignments outside their validity window', async () => {
    const repositories = createRepos()
    await savePermission(repositories, {
      id: 'spa-future',
      permission: Permission.PAYMENT_READ,
      startsAt: new Date('2026-02-01T00:00:00Z'),
    })

    await expect(resolveEffectiveGrants({
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      academicYearId: ACADEMIC_YEAR_ID,
      repositories,
      now: new Date('2026-01-01T00:00:00Z'),
    })).rejects.toThrow()
  })

  test('reports earliest assignment expiry for cache bounds', async () => {
    const repositories = createRepos()
    await savePermission(repositories, {
      id: 'spa-temporary',
      permission: Permission.PAYMENT_READ,
      endsAt: new Date('2026-01-02T00:00:00Z'),
    })

    const grants = await resolveEffectiveGrants({
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      academicYearId: ACADEMIC_YEAR_ID,
      repositories,
      now: new Date('2026-01-01T00:00:00Z'),
    })

    expect(grants.expiresAt?.toISOString()).toBe('2026-01-02T00:00:00.000Z')
  })

  test('rejects grant resolution if no database assignments exist', async () => {
    const repositories = createRepos()
    await expect(resolveEffectiveGrants({
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      academicYearId: ACADEMIC_YEAR_ID,
      repositories,
    })).rejects.toBeInstanceOf(AuthorizationError)
  })
})
