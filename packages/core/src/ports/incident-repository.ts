import type { Incident } from '$lib/core/entities/students/incident'
import type { BaseRepositoryInterface } from './_base-repository'

export interface IncidentRepository extends BaseRepositoryInterface<Incident> {
  listBySchool: (schoolId: string) => Promise<Incident[]>
}
