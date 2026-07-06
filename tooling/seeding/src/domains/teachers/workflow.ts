import type { FixtureDataset } from '@edaya/fixtures'
import type { TeachersSeedPort } from './port'

export async function seedDevTeachers(
  port: TeachersSeedPort,
  dataset: FixtureDataset,
): Promise<void> {
  const teachers = dataset.entities.teachers ?? []
  const teacherAssignments = dataset.entities.teacherAssignments ?? []

  for (const teacher of teachers) {
    await port.saveTeacher({
      id: teacher.id,
      schoolId: dataset.schoolId,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      email: teacher.email ?? undefined,
    })
  }

  for (const assignment of teacherAssignments) {
    await port.saveTeacherAssignment({
      id: assignment.id,
      teacherId: assignment.teacherId,
      academicYearId: assignment.academicYearId,
      kind: assignment.kind,
      classSubjectId: assignment.classSubjectId ?? undefined,
      classGroupId: assignment.classGroupId ?? undefined,
      responsibility: assignment.responsibility ?? undefined,
      status: assignment.status,
    })
  }
}
