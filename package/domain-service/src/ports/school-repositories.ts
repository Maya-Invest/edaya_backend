import type { AuthorizationRepository } from '@edaya/authorization'
import type {
  AccountInvitationRepository,
  BaseRepositoryInterface,
  CoreEntityRepositories,
  PlatformUserRepository,
  S2sClientRepository,
  School,
  SchoolNotificationTemplatesRepository,
  ServiceApiKeyRepository,
} from '@edaya/core'
import type { GetSchoolOverviewInput, SchoolOverview } from '../services/queries/school-overview'
import type { CronJobSchedulePort } from './platform/cron-job-schedule'

export interface SchoolRepositories extends CoreEntityRepositories {
  readonly authorization: AuthorizationRepository
  readonly cronJobSchedules: CronJobSchedulePort
  readonly serviceApiKeys: ServiceApiKeyRepository
  readonly platformUsers: PlatformUserRepository
  readonly s2sClients: S2sClientRepository
  readonly accountInvitations: AccountInvitationRepository
  readonly schoolNotificationTemplates: SchoolNotificationTemplatesRepository
  readonly schools: BaseRepositoryInterface<School> & {
    getOverdueFeeCount: (schoolId: string) => Promise<number>
    getPublishedReportCardCount: (schoolId: string) => Promise<number>
    getSchoolOverview: (input: GetSchoolOverviewInput) => Promise<SchoolOverview>
  }
}
