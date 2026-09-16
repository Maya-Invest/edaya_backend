import type { AccountInvitationRepository, Allocation, AttachmentUploadStore, BaseRepositoryInterface, CoreEntityRepositories, DocumentNumberSeries, FamilyFeedbackCampaign, FamilyFeedbackCommentReadAudit, FamilyFeedbackResponse, FamilyFeedbackSlot, FamilyFeedbackSnapshot, PlatformUserRepository, PrivateFileLifecycleStore, S2sClientRepository, SchoolNotificationTemplatesRepository, ServiceApiKeyRepository, StudentAccountEntry } from '@edaya/core'
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
  readonly allocations: BaseRepositoryInterface<Allocation>
  readonly studentAccountEntries: BaseRepositoryInterface<StudentAccountEntry>
  readonly documentNumberSeries: BaseRepositoryInterface<DocumentNumberSeries>
  readonly familyFeedbackCampaigns: BaseRepositoryInterface<FamilyFeedbackCampaign>
  readonly familyFeedbackSlots: BaseRepositoryInterface<FamilyFeedbackSlot>
  readonly familyFeedbackResponses: BaseRepositoryInterface<FamilyFeedbackResponse>
  readonly familyFeedbackSnapshots: BaseRepositoryInterface<FamilyFeedbackSnapshot>
  readonly familyFeedbackCommentReadAudit: BaseRepositoryInterface<FamilyFeedbackCommentReadAudit>
}
