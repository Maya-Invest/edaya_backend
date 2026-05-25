import type { StudentDisciplinaryAction } from '../entities/students/student-disciplinary-action'
import type { BaseRepositoryInterface } from './_base-repository'

export interface StudentDisciplinaryActionRepository extends BaseRepositoryInterface<StudentDisciplinaryAction> {
  listByStudent: (studentId: string) => Promise<StudentDisciplinaryAction[]>
  listByIncident: (incidentId: string) => Promise<StudentDisciplinaryAction[]>
}
