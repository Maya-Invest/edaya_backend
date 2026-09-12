import type { AccountInvitationRepository, BaseRepositoryInterface, CoreEntityRepositories, School, SchoolNotificationTemplatesRepository, ServiceApiKeyRepository } from '@edaya/core';
import type { GetSchoolOverviewInput, SchoolOverview } from '../services/queries/school-overview';
import type { CronJobSchedulePort } from './platform/cron-job-schedule';

export interface SchoolRepositories extends CoreEntityRepositories {
  readonly cronJobSchedules: CronJobSchedulePort
  readonly serviceApiKeys: ServiceApiKeyRepository
  readonly accountInvitations: AccountInvitationRepository
  readonly schoolNotificationTemplates: SchoolNotificationTemplatesRepository
  readonly schools: BaseRepositoryInterface<School> & {
    getOverdueFeeCount: (schoolId: string) => Promise<number>
    getPublishedReportCardCount: (schoolId: string) => Promise<number>
    getSchoolOverview: (input: GetSchoolOverviewInput) => Promise<SchoolOverview>
  }
}
