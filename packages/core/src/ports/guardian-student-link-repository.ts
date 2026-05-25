import type { GuardianStudentLink } from '../entities/students/guardian-student-link'
import type { BaseRepositoryInterface } from './_base-repository'

export interface GuardianStudentLinkRepository extends BaseRepositoryInterface<GuardianStudentLink> {
  findByGuardianAndStudent: (guardianId: string, studentId: string) => Promise<GuardianStudentLink | undefined>
  listByGuardian: (guardianId: string) => Promise<GuardianStudentLink[]>
  listByStudent: (studentId: string) => Promise<GuardianStudentLink[]>
}
