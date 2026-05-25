import type { StudentIncidentInvolvement } from '../entities/students/student-incident-involvement'
import type { BaseRepositoryInterface } from './_base-repository'

export interface StudentIncidentInvolvementRepository extends BaseRepositoryInterface<StudentIncidentInvolvement> {
  findByIncidentAndStudent: (
    incidentId: string,
    studentId: string,
  ) => Promise<StudentIncidentInvolvement | undefined>
  listByIncident: (incidentId: string) => Promise<StudentIncidentInvolvement[]>
  listByStudent: (studentId: string) => Promise<StudentIncidentInvolvement[]>
}
