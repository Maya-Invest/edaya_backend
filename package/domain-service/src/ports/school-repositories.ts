import type { AccountInvitationRepository, AttachmentUploadStore, CoreEntityRepositories, PlatformUserRepository, PrivateFileLifecycleStore, S2sClientRepository, SchoolNotificationTemplatesRepository, ServiceApiKeyRepository } from '@edaya/core'
import type { CronJobSchedulePort } from './platform/cron-job-schedule'

export interface SchoolRepositories extends CoreEntityRepositories {
  readonly privateFiles: PrivateFileLifecycleStore
  readonly attachmentUploads: AttachmentUploadStore
  readonly cronJobSchedules: CronJobSchedulePort
  readonly serviceApiKeys: ServiceApiKeyRepository
  readonly platformUsers: PlatformUserRepository
  readonly s2sClients: S2sClientRepository
  readonly accountInvitations: AccountInvitationRepository
  readonly schoolNotificationTemplates: SchoolNotificationTemplatesRepository

}
