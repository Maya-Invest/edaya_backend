import type { StudentNote } from '$lib/core/entities/students/student-note'
import type { BaseRepositoryInterface } from './_base-repository'

export interface StudentNoteRepository extends BaseRepositoryInterface<StudentNote> {
  listByStudent: (studentId: string) => Promise<StudentNote[]>
}
