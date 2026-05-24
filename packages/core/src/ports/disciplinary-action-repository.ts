import type { DisciplinaryAction } from '$lib/core/entities/students/disciplinary-action'
import type { BaseRepositoryInterface } from './_base-repository'

export interface DisciplinaryActionRepository extends BaseRepositoryInterface<DisciplinaryAction> {
  listBySchool: (schoolId: string) => Promise<DisciplinaryAction[]>
}
