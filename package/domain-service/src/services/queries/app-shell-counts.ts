import type { SchoolRepositories } from '../../ports/school-repositories'
import { StudentClassEnrollmentStatus } from '@edaya/core'

export interface GetAppShellCountsInput {
  schoolId: string
  classGroupIds?: readonly string[]
}

export interface AppShellCounts {
  schoolId: string
  activeEnrollmentCountsByClass: Record<string, number>
  studentCount: number
  guardianCount: number
  staffCount: number
}

export async function buildAppShellCounts(
  repositories: Pick<SchoolRepositories, 'students' | 'guardians' | 'staffMembers' | 'enrollments'>,
  input: GetAppShellCountsInput,
): Promise<AppShellCounts> {
  const classGroupIds = [...new Set(input.classGroupIds ?? [])]

  const [studentCount, guardianCount, staffCount, enrollments] = await Promise.all([
    repositories.students.count({ schoolId: input.schoolId }),
    repositories.guardians.count({ schoolId: input.schoolId }),
    repositories.staffMembers.count({ schoolId: input.schoolId }),
    classGroupIds.length > 0
      ? repositories.enrollments.list({
          status: StudentClassEnrollmentStatus.Active,
          classGroupId: { $in: classGroupIds },
        })
      : Promise.resolve([]),
  ])

  const activeEnrollmentCountsByClass = Object.fromEntries(
    classGroupIds.map(classGroupId => [classGroupId, 0]),
  ) as Record<string, number>

  for (const enrollment of enrollments) {
    activeEnrollmentCountsByClass[enrollment.classGroupId]
      = (activeEnrollmentCountsByClass[enrollment.classGroupId] ?? 0) + 1
  }

  return {
    schoolId: input.schoolId,
    activeEnrollmentCountsByClass,
    studentCount,
    guardianCount,
    staffCount,
  }
}
