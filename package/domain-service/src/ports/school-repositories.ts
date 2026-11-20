import type { AccountInvitationRepository, Allocation, AssessmentDependenciesPort, AttachmentUploadStore, BaseRepositoryInterface, CoreEntityRepositories, DashboardProjectionPort, DocumentNumberSeries, FamilyFeedbackCampaign, FamilyFeedbackCommentReadAudit, FamilyFeedbackResponse, FamilyFeedbackSlot, FamilyFeedbackSnapshot, FinanceProjectionPort, MarksCorrectionsPort, PlatformUserRepository, PrivateFileLifecycleStore, S2sClientRepository, SchoolNotificationTemplatesRepository, ServiceApiKeyRepository, StudentAccountEntry, TeacherCorrectionsPort } from '@edaya/core'
import type { CronJobSchedulePort } from './platform/cron-job-schedule'

export interface SchoolRepositories extends CoreEntityRepositories {
  readonly autoBilling: import('@edaya/core').AutoBillingPort
  readonly studentHistory: import('@edaya/core').StudentHistoryPort
  readonly deliveryInbox: import('@edaya/core').DeliveryInboxPort
  readonly guardianHome: import('@edaya/core').GuardianHomePort
  readonly teacherIncidents: import('@edaya/core').TeacherIncidentsPort
  readonly teacherLogbook: import('@edaya/core').TeacherLogbookPort
  readonly staffFeedbackOptions: import('@edaya/core').StaffFeedbackOptionsPort
  readonly guardianChildProfile: import('@edaya/core').GuardianChildProfilePort
  readonly classReportRoster: import('@edaya/core').ClassReportRosterPort
  readonly staffActivityPupils: import('@edaya/core').StaffActivityPupilsPort
  readonly incidentLessonOptions: import('@edaya/core').IncidentLessonOptionsPort
  readonly activityMembershipCounts: import('@edaya/core').ActivityMembershipCounts
  readonly staffFeedbackHistory: import('@edaya/core').StaffFeedbackHistoryPort
  readonly teacherFeedbackSummaries: import('@edaya/core').TeacherFeedbackSummariesPort
  readonly studentDirectory: import('@edaya/core').StudentDirectoryPort
  readonly financeProjections: FinanceProjectionPort
  readonly dashboardProjections: DashboardProjectionPort
  readonly conversations: import('@edaya/core').ConversationsPort
  readonly teacherCorrections: TeacherCorrectionsPort
  readonly marksCorrections: MarksCorrectionsPort
  readonly assessmentDependencies: AssessmentDependenciesPort
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
