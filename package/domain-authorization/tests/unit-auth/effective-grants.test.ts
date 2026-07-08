import {
  AuthorizationError,
  ELEVATED_STAFF_PERMISSIONS,
  Permission,
  resolveEffectiveGrants,
  scopeGrantCovers,
} from '@edaya/authorization'
import { StaffMember } from '@edaya/core'
import { describe, expect, mock, test } from 'bun:test'
import {
  asAuthorizationRepos,
  createAuthorizationRepos,
  createGrantRepos,
  GRANT_TEST_ACADEMIC_YEAR_ID,
  saveStaffPermission,
} from '../support/resolve-grants-fixtures'

const resolveArgs = {
  staffMemberId: 'staff-1',
  schoolId: 'school-1',
  academicYearId: GRANT_TEST_ACADEMIC_YEAR_ID,
}

describe('resolveEffectiveGrants', () => {
  test('grants school owner full school-scoped access without role assignments', async () => {
    const grants = await resolveEffectiveGrants({
      ...resolveArgs,
      repositories: createAuthorizationRepos([], 'subject-owner', 'subject-owner'),
    })

    expect(grants.isElevated).toBe(true)
    expect(grants.permissions.has(Permission.SCHOOL_LIFECYCLE_MANAGE)).toBe(true)
    expect(grants.permissions.has(Permission.PLATFORM_REGISTER_SCHOOL)).toBe(false)
    expect(grants.permissions.size).toBe(ELEVATED_STAFF_PERMISSIONS.length)
  })

  test('grants elevated access to owner-level service accounts', async () => {
    const repositories = createGrantRepos()
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
      ...resolveArgs,
      staffMemberId: 'staff-service-1',
      repositories: asAuthorizationRepos(repositories),
    })

    expect(grants.isElevated).toBe(true)
    expect(grants.permissions.has(Permission.STUDENT_CREATE)).toBe(true)
    expect(grants.permissions.has(Permission.PLATFORM_REGISTER_SCHOOL)).toBe(false)
  })

  test('grants staff permissions with school and class-group scope', async () => {
    const repositories = createGrantRepos([
      { id: 'a-1', staffId: 'staff-1', classGroupId: 'class-1' },
    ])
    await saveStaffPermission(repositories, { id: 'spa-payment-record', permission: Permission.PAYMENT_RECORD })
    await saveStaffPermission(repositories, {
      id: 'spa-attendance-record',
      permission: Permission.ATTENDANCE_RECORD,
      scopeIds: 'class-1',
    })

    const grants = await resolveEffectiveGrants({
      ...resolveArgs,
      repositories: asAuthorizationRepos(repositories),
    })

    expect(grants.isElevated).toBe(false)
    expect(grants.permissions.has(Permission.PAYMENT_RECORD)).toBe(true)
    expect(grants.permissions.has(Permission.ATTENDANCE_RECORD)).toBe(true)
    expect(scopeGrantCovers(grants, {
      permission: Permission.PAYMENT_RECORD,
      schoolId: 'school-1',
      scopeType: 'school',
      scopeEntityId: 'school-1',
      isElevated: grants.isElevated,
    })).toBe(true)
    expect(scopeGrantCovers(grants, {
      permission: Permission.ATTENDANCE_RECORD,
      schoolId: 'school-1',
      scopeType: 'class_group',
      scopeEntityId: 'class-1',
      isElevated: grants.isElevated,
    })).toBe(true)
    expect(scopeGrantCovers(grants, {
      permission: Permission.ATTENDANCE_RECORD,
      schoolId: 'school-1',
      scopeType: 'class_group',
      scopeEntityId: 'class-2',
      isElevated: grants.isElevated,
    })).toBe(false)
  })

  test('grants split payment permissions to accountants', async () => {
    const repositories = createGrantRepos()
    for (const [index, permission] of [
      Permission.PAYMENT_RECORD,
      Permission.PAYMENT_CANCEL,
      Permission.PAYMENT_REVERSE,
      Permission.FINANCIAL_CONFIG_READ,
      Permission.FINANCIAL_CONFIG_CONFIGURE,
      Permission.FINANCIAL_CONFIG_UPDATE,
    ].entries()) {
      await saveStaffPermission(repositories, { id: `spa-accountant-${index}`, permission })
    }

    const grants = await resolveEffectiveGrants({
      ...resolveArgs,
      repositories: asAuthorizationRepos(repositories),
    })
    expect(grants.permissions.has(Permission.PAYMENT_RECORD)).toBe(true)
    expect(grants.permissions.has(Permission.FINANCIAL_CONFIG_UPDATE)).toBe(true)
  })

  test('ignores active assignments outside their validity window', async () => {
    const repositories = createGrantRepos()
    await saveStaffPermission(repositories, {
      id: 'spa-future',
      permission: Permission.PAYMENT_READ,
      startsAt: new Date('2026-02-01T00:00:00Z'),
    })

    await expect(resolveEffectiveGrants({
      ...resolveArgs,
      repositories: asAuthorizationRepos(repositories),
      now: new Date('2026-01-01T00:00:00Z'),
    })).rejects.toThrow()
  })

  test('reports earliest assignment expiry for cache bounds', async () => {
    const repositories = createGrantRepos()
    await saveStaffPermission(repositories, {
      id: 'spa-temporary',
      permission: Permission.PAYMENT_READ,
      endsAt: new Date('2026-01-02T00:00:00Z'),
    })

    const grants = await resolveEffectiveGrants({
      ...resolveArgs,
      repositories: asAuthorizationRepos(repositories),
      now: new Date('2026-01-01T00:00:00Z'),
    })

    expect(grants.expiresAt?.toISOString()).toBe('2026-01-02T00:00:00.000Z')
  })

  test('rejects grant resolution if no database assignments exist', async () => {
    await expect(resolveEffectiveGrants({
      ...resolveArgs,
      repositories: createAuthorizationRepos(),
    })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('falls back to the active academic year when omitted', async () => {
    const repositories = createGrantRepos([], undefined, undefined, [
      { id: 'year-1', schoolId: 'school-1', name: '2025-2026', isActive: true },
    ])
    await saveStaffPermission(repositories, { id: 'spa-read', permission: Permission.PAYMENT_READ })

    const grants = await resolveEffectiveGrants({
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      repositories: asAuthorizationRepos(repositories),
    })

    expect(grants.permissions.has(Permission.PAYMENT_READ)).toBe(true)
  })
})
