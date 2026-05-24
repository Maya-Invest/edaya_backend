import type { StudentFee } from '$lib/core/entities/finances/student-fee'
import type { BaseRepositoryInterface } from './_base-repository'

export interface StudentFeeRepository extends BaseRepositoryInterface<StudentFee> {
  listByStudent: (studentId: string) => Promise<StudentFee[]>
}
