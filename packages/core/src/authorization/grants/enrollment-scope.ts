import type { SchoolRepositories } from '../../ports/school-repositories'

/** Matches `StudentClassEnrollmentStatus.Active` without importing the enrollment domain module. */
const ACTIVE_ENROLLMENT_STATUS = 'active' as const

export async function activeClassGroupIdsByStudent(
  repositories: SchoolRepositories,
  studentIds: readonly string[],
): Promise<Map<string, string>> {
  if (studentIds.length === 0) {
    return new Map()
  }

  const uniqueStudentIds = [...new Set(studentIds)]
  const enrollments = await repositories.enrollments.list({
    studentId: { $in: uniqueStudentIds },
    status: ACTIVE_ENROLLMENT_STATUS,
  })

  const classGroupByStudent = new Map<string, string>()
  for (const enrollment of enrollments) {
    if (enrollment.status === ACTIVE_ENROLLMENT_STATUS) {
      classGroupByStudent.set(enrollment.studentId, enrollment.classGroupId)
    }
  }

  return classGroupByStudent
}

export async function uniqueActiveClassGroupIds(
  repositories: SchoolRepositories,
  studentIds: readonly string[],
): Promise<string[]> {
  const classGroupByStudent = await activeClassGroupIdsByStudent(repositories, studentIds)
  return [...new Set(classGroupByStudent.values())]
}
