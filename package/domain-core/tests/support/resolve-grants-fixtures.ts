import type { Permission } from '../../src/capabilities/authorization'
import type { SchoolRepositories } from '../../src/ports'
import { mock } from 'bun:test'
import { School, StaffPermissionAssignment } from '../../src/domain'

export const GRANT_TEST_ACADEMIC_YEAR_ID = 'year-1'

interface PermissionListFilter {
  staffId?: string
  schoolId?: string
  academicYearId?: string
  status?: string
}

export function createGrantRepos(
  assignments: unknown[] = [],
  ownerSubjectId?: string,
  staffSubjectId?: string,
  academicYears: Array<{ id: string, schoolId: string, name: string, isActive: boolean }> = [],
): SchoolRepositories {
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
    staffAssignments: { list: mock(async () => assignments) },
    academicYears: { list: mock(async () => academicYears) },
    staffPermissionAssignments: {
      list: mock(async (filter: PermissionListFilter = {}) => [...permissionStore.values()].filter((row) => {
        if (filter.staffId && filter.staffId !== row.staffId)
          return false
        if (filter.schoolId && filter.schoolId !== row.schoolId)
          return false
        if (filter.academicYearId && filter.academicYearId !== row.academicYearId)
          return false
        if (filter.status && filter.status !== row.status)
          return false
        return true
      })),
      save: mock(async (entity: StaffPermissionAssignment) => {
        permissionStore.set(entity.id, entity)
      }),
    },
  } as unknown as SchoolRepositories
}

export async function saveStaffPermission(
  repositories: SchoolRepositories,
  input: {
    id: string
    permission: Permission
    scopeIds?: string
    startsAt?: Date
    endsAt?: Date
    staffId?: string
  },
): Promise<void> {
  await repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({
    id: input.id,
    staffId: input.staffId ?? 'staff-1',
    schoolId: 'school-1',
    academicYearId: GRANT_TEST_ACADEMIC_YEAR_ID,
    permission: input.permission,
    scopeIds: input.scopeIds ?? '',
    status: 'active',
    ...(input.startsAt ? { startsAt: input.startsAt } : {}),
    ...(input.endsAt ? { endsAt: input.endsAt } : {}),
  }))
}
