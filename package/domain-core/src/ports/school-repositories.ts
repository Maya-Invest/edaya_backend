import type { AuthorizationRepository } from '../authorization/resolution/authorization-repository'
import type { CoreEntityMap } from '../core-entity-map'
import type { School } from '../domains'
import type { GetSchoolOverviewInput, SchoolOverview } from '../queries/school-overview'
import type { BaseRepositoryInterface } from './base-repository'
import type { ServiceApiKeyRepository } from './service-api-key-repository'

export type CoreEntityRepositories = {
  readonly [Key in keyof CoreEntityMap]: BaseRepositoryInterface<CoreEntityMap[Key]>
}

export interface SchoolRepositories extends CoreEntityRepositories {
  readonly authorization: AuthorizationRepository
  readonly serviceApiKeys: ServiceApiKeyRepository
  readonly schools: BaseRepositoryInterface<School> & {
    getOverdueFeeCount: (schoolId: string) => Promise<number>
    getPublishedReportCardCount: (schoolId: string) => Promise<number>
    getSchoolOverview: (input: GetSchoolOverviewInput) => Promise<SchoolOverview>
  }
}
