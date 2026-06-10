import type { SchoolRepositories } from '../ports/school-repositories'
import { StudentClassEnrollmentStatus } from '../domains'

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
    status: StudentClassEnrollmentStatus.Active,
  })

  const classGroupByStudent = new Map<string, string>()
  for (const enrollment of enrollments) {
    if (enrollment.status === StudentClassEnrollmentStatus.Active) {
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
