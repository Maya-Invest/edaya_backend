import type { StudentNote } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'
import { denyResourceAccess } from '@edaya/authorization'
import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

// Extracted from domain/students/student-note.ts (PR3)
export const studentNoteConfig: EntityConfigFactory<StudentNote> = ({ repositories, atomicExecution }) => {
  return {
    ...config({
      repository: repositories.studentNotes,
      tenant: directSchoolTenant(),
      resource: 'studentNotes',

      atomicExecution,
    }),
    gates: {
      preSave: validateStudentNoteSave,
    },
  }
}

export async function validateStudentNoteSave(
  note: StudentNote,
  existing: StudentNote | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const student = await repositories.students.findById(note.studentId)
  if (!student || student.schoolId !== note.schoolId) {
    denyResourceAccess()
  }
  if (existing) {
    if (existing.schoolId !== note.schoolId || existing.studentId !== note.studentId || existing.authorStaffId !== note.authorStaffId) {
      denyResourceAccess()
    }
  }
}
