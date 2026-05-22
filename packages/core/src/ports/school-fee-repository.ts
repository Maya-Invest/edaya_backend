import type { SchoolFee } from '$lib/core/entities/finance/school-fee'
import type { BaseRepositoryInterface } from './_base-repository'

export interface SchoolFeeRepository extends BaseRepositoryInterface<SchoolFee> {
  listByStudent: (studentId: string) => Promise<SchoolFee[]>
}
