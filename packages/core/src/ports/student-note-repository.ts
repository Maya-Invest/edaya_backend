import type { StudentNote } from '../entities/students/student-note'
import type { BaseRepositoryInterface } from './_base-repository'

export interface StudentNoteRepository extends BaseRepositoryInterface<StudentNote> {
  listByStudent: (studentId: string) => Promise<StudentNote[]>
}
