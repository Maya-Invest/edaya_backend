import type { AcademicDiscipline, AcademicPeriod, AcademicYear, Activity, ActivityEnrollment, ActivitySession, Allocation, Announcement, AnnouncementTarget, Assessment, AssessmentResult, Attachment, Attendance, AttendanceRecord, CalendarEvent, CatalogService, ClassActivityEnrollment, ClassGroup, ClassSubject, ClassSubjectMatter, ClassSubjectProgress, DisciplinaryAction, DocumentIssuance, DocumentNumberSeries, FamilyFeedbackCampaign, FamilyFeedbackCommentReadAudit, FamilyFeedbackResponse, FamilyFeedbackSlot, FamilyFeedbackSnapshot, GradeLevel, GradeScale, Guardian, GuardianStudentLink, Incident, LessonSession, MessageDelivery, Payment, PeriodDefinition, PlacementStatus, ReportCardDefinition, ReportCardDefinitionSection, ReportCardResult, Resource, ResourceAssignment, Schedule, School, StaffAssignment, StaffManualPermissionAssignment, StaffMember, StaffPermissionAssignment, StaffPermissionProfile, StaffPermissionProfileBinding, StaffPermissionScopeDefaults, Student, StudentAcademicYearProfile, StudentAccountEntry, StudentCharge, StudentClassEnrollment, StudentDisciplinaryAction, StudentHealthProfile, StudentIncidentInvolvement, StudentNote, StudentPhotoSubmission, StudentServiceEnrollment, StudentSubjectEnrollment, StudentYearAccount, Subject, SubjectCategoryEntity, SubjectMatter, Teacher, TeacherAcademicYearProfile, TeacherAssignment, TeacherUnavailability } from '@edaya/core'
import type { SchoolRepositories } from '@edaya/service'
import type { MigrationDriver } from './lib/migrate'
import type { RepositoryStore as PostgresStore, StoreDatabase } from './postgres-store'
import { runMigrations } from './lib/migrate'
import { clearAllTables } from './lib/schema-init'
import { asStoreDatabase } from './postgres-store'
import { PostgresAccountInvitationStore } from './stores/account-invitation-store'
import { PostgresAssessmentDependencies } from './stores/assessment-dependencies-store'
import { PostgresAttachmentUploadStore } from './stores/attachment-upload-store'
import { PostgresAutoBilling } from './stores/auto-billing-store'
import { PostgresConversations } from './stores/conversations-store'
import { PostgresCronJobScheduleStore } from './stores/cron-job-schedule-store'
import { PostgresDashboardProjections } from './stores/dashboard-projections-store'
import { createEntityStores } from './stores/entity-stores'
import { createDocumentNumberSeriesStore } from './stores/entity-stores-documents'
import { createFamilyFeedbackStores } from './stores/entity-stores-family-feedback'
import { createFinanceLedgerStores } from './stores/entity-stores-finance-ledger'
import { PostgresFinanceProjections } from './stores/finance-projections-store'
import { PostgresMarksCorrections } from './stores/marks-corrections-store'
import { PostgresPlatformUserStore } from './stores/platform-user-store'
import { PostgresPrivateFileLifecycleStore } from './stores/private-file-lifecycle-store'
import { PostgresS2sClientStore } from './stores/s2s-client-store'
import { PostgresSchoolNotificationTemplatesStore } from './stores/school-notification-templates-store'
import { PostgresServiceApiKeyStore } from './stores/service-api-key-store'
import { PostgresStaffPermissionAssignmentStore } from './stores/staff-permission-assignment-store'
import { PostgresTeacherCorrections } from './stores/teacher-corrections-store'

export class PostgresSchoolRepositories implements SchoolRepositories {
  public readonly autoBilling: PostgresAutoBilling
  public readonly academicDisciplines: PostgresStore<AcademicDiscipline>
  public readonly placementStatuses: PostgresStore<PlacementStatus>
  public readonly studentAcademicYearProfiles: PostgresStore<StudentAcademicYearProfile>
  public readonly teacherAcademicYearProfiles: PostgresStore<TeacherAcademicYearProfile>

  public readonly financeProjections: PostgresFinanceProjections
  public readonly dashboardProjections: PostgresDashboardProjections
  public readonly conversations: PostgresConversations
  public readonly teacherCorrections: PostgresTeacherCorrections
  public readonly marksCorrections: PostgresMarksCorrections
  public readonly assessmentDependencies: PostgresAssessmentDependencies
  public readonly privateFiles: PostgresPrivateFileLifecycleStore
  public readonly attachmentUploads: PostgresAttachmentUploadStore
  public readonly schoolsStore: PostgresStore<School>
  public readonly academicYears: PostgresStore<AcademicYear>
  public readonly academicPeriods: PostgresStore<AcademicPeriod>
  public readonly periodDefinitions: PostgresStore<PeriodDefinition>
  public readonly gradeLevels: PostgresStore<GradeLevel>
  public readonly staffMembers: PostgresStore<StaffMember>
  public readonly staffAssignments: PostgresStore<StaffAssignment>
  public readonly teachers: PostgresStore<Teacher>
  public readonly teacherAssignments: PostgresStore<TeacherAssignment>
  public readonly teacherUnavailabilities: PostgresStore<TeacherUnavailability>
  public readonly serviceApiKeys: PostgresServiceApiKeyStore
  public readonly platformUsers: PostgresPlatformUserStore
  public readonly s2sClients: PostgresS2sClientStore
  public readonly accountInvitations: PostgresAccountInvitationStore
  public readonly cronJobSchedules: PostgresCronJobScheduleStore
  public readonly schoolNotificationTemplates: PostgresSchoolNotificationTemplatesStore
  public readonly staffPermissionAssignments: PostgresStore<StaffPermissionAssignment>
  public readonly staffPermissionProfiles: PostgresStore<StaffPermissionProfile>
  public readonly staffPermissionScopeDefaults: PostgresStore<StaffPermissionScopeDefaults>
  public readonly staffManualPermissionAssignments: PostgresStore<StaffManualPermissionAssignment>
  public readonly staffPermissionProfileBindings: PostgresStore<StaffPermissionProfileBinding>
  public readonly attachments: PostgresStore<Attachment>
  public readonly resources: PostgresStore<Resource>
  public readonly resourceAssignments: PostgresStore<ResourceAssignment>
  public readonly catalogServices: PostgresStore<CatalogService>
  public readonly studentServiceEnrollments: PostgresStore<StudentServiceEnrollment>
  public readonly studentCharges: PostgresStore<StudentCharge>
  public readonly studentYearAccounts: PostgresStore<StudentYearAccount>
  public readonly payments: PostgresStore<Payment>
  public readonly allocations: PostgresStore<Allocation>
  public readonly studentAccountEntries: PostgresStore<StudentAccountEntry>
  public readonly schedules: PostgresStore<Schedule>
  public readonly attendances: PostgresStore<Attendance>
  public readonly lessonSessions: PostgresStore<LessonSession>
  public readonly activitySessions: PostgresStore<ActivitySession>
  public readonly calendarEvents: PostgresStore<CalendarEvent>
  public readonly attendance: PostgresStore<AttendanceRecord>
  public readonly announcements: PostgresStore<Announcement>
  public readonly announcementTargets: PostgresStore<AnnouncementTarget>
  public readonly messageDeliveries: PostgresStore<MessageDelivery>
  public readonly subjects: PostgresStore<Subject>
  public readonly subjectCategories: PostgresStore<SubjectCategoryEntity>
  public readonly subjectMatters: PostgresStore<SubjectMatter>
  public readonly classGroups: PostgresStore<ClassGroup>
  public readonly classSubjects: PostgresStore<ClassSubject>
  public readonly classSubjectMatters: PostgresStore<ClassSubjectMatter>
  public readonly classSubjectProgress: PostgresStore<ClassSubjectProgress>
  public readonly activities: PostgresStore<Activity>
  public readonly activityEnrollments: PostgresStore<ActivityEnrollment>
  public readonly classActivityEnrollments: PostgresStore<ClassActivityEnrollment>
  public readonly assessments: PostgresStore<Assessment>
  public readonly assessmentResults: PostgresStore<AssessmentResult>
  public readonly gradeScales: PostgresStore<GradeScale>
  public readonly definitions: PostgresStore<ReportCardDefinition>
  public readonly sections: PostgresStore<ReportCardDefinitionSection>
  public readonly results: PostgresStore<ReportCardResult>
  public readonly students: PostgresStore<Student>
  public readonly subjectEnrollments: PostgresStore<StudentSubjectEnrollment>
  public readonly enrollments: PostgresStore<StudentClassEnrollment>
  public readonly guardians: PostgresStore<Guardian>
  public readonly guardianLinks: PostgresStore<GuardianStudentLink>
  public readonly studentNotes: PostgresStore<StudentNote>
  public readonly studentPhotoSubmissions: PostgresStore<StudentPhotoSubmission>
  public readonly studentHealthProfiles: PostgresStore<StudentHealthProfile>
  public readonly studentDisciplinaryActions: PostgresStore<StudentDisciplinaryAction>
  public readonly disciplinaryActions: PostgresStore<DisciplinaryAction>
  public readonly studentIncidentInvolvements: PostgresStore<StudentIncidentInvolvement>
  public readonly incidents: PostgresStore<Incident>
  public readonly documentIssuances: PostgresStore<DocumentIssuance>
  public readonly documentNumberSeries: PostgresStore<DocumentNumberSeries>
  public readonly familyFeedbackCampaigns: PostgresStore<FamilyFeedbackCampaign>
  public readonly familyFeedbackSlots: PostgresStore<FamilyFeedbackSlot>
  public readonly familyFeedbackResponses: PostgresStore<FamilyFeedbackResponse>
  public readonly familyFeedbackSnapshots: PostgresStore<FamilyFeedbackSnapshot>
  public readonly familyFeedbackCommentReadAudit: PostgresStore<FamilyFeedbackCommentReadAudit>
  public readonly schools: SchoolRepositories['schools']

  private readonly db: StoreDatabase
  constructor(database: unknown) {
    const db = asStoreDatabase(database)
    this.db = db
    this.autoBilling = new PostgresAutoBilling(db)
    this.financeProjections = new PostgresFinanceProjections(db)
    this.dashboardProjections = new PostgresDashboardProjections(db)
    this.conversations = new PostgresConversations(db)
    this.teacherCorrections = new PostgresTeacherCorrections(db)
    this.marksCorrections = new PostgresMarksCorrections(db)
    this.assessmentDependencies = new PostgresAssessmentDependencies(db)
    this.privateFiles = new PostgresPrivateFileLifecycleStore(db)
    this.attachmentUploads = new PostgresAttachmentUploadStore(db)
    const stores = createEntityStores(db)
    this.academicDisciplines = stores.academicDisciplines
    this.placementStatuses = stores.placementStatuses
    this.studentAcademicYearProfiles = stores.studentAcademicYearProfiles
    this.teacherAcademicYearProfiles = stores.teacherAcademicYearProfiles

    // consortiums store remains registered in createEntityStores for schema init / legacy rows
    this.schoolsStore = stores.schoolsStore
    this.academicYears = stores.academicYears
    this.academicPeriods = stores.academicPeriods
    this.periodDefinitions = stores.periodDefinitions
    this.gradeLevels = stores.gradeLevels
    this.staffMembers = stores.staffMembers
    this.staffAssignments = stores.staffAssignments
    this.staffPermissionProfiles = stores.staffPermissionProfiles
    this.staffPermissionScopeDefaults = stores.staffPermissionScopeDefaults
    this.staffManualPermissionAssignments = stores.staffManualPermissionAssignments
    this.staffPermissionProfileBindings = stores.staffPermissionProfileBindings
    this.teachers = stores.teachers
    this.teacherAssignments = stores.teacherAssignments
    this.teacherUnavailabilities = stores.teacherUnavailabilities
    this.serviceApiKeys = new PostgresServiceApiKeyStore(db)
    this.platformUsers = new PostgresPlatformUserStore(db)
    this.s2sClients = new PostgresS2sClientStore(db)
    this.accountInvitations = new PostgresAccountInvitationStore(db)
    this.cronJobSchedules = new PostgresCronJobScheduleStore(db)
    this.schoolNotificationTemplates = new PostgresSchoolNotificationTemplatesStore(db)
    this.attachments = stores.attachments
    this.resources = stores.resources
    this.resourceAssignments = stores.resourceAssignments
    this.catalogServices = stores.catalogServices
    this.studentServiceEnrollments = stores.studentServiceEnrollments
    this.studentCharges = stores.studentCharges
    this.studentYearAccounts = stores.studentYearAccounts
    this.payments = stores.payments
    const ledger = createFinanceLedgerStores(db)
    this.allocations = ledger.allocations
    this.studentAccountEntries = ledger.studentAccountEntries
    this.schedules = stores.schedules
    this.attendances = stores.attendances
    this.lessonSessions = stores.lessonSessions
    this.activitySessions = stores.activitySessions
    this.calendarEvents = stores.calendarEvents
    this.attendance = stores.attendance
    this.announcements = stores.announcements
    this.announcementTargets = stores.announcementTargets
    this.messageDeliveries = stores.messageDeliveries
    this.subjects = stores.subjects
    this.subjectCategories = stores.subjectCategories
    this.subjectMatters = stores.subjectMatters
    this.classGroups = stores.classGroups
    this.classSubjects = stores.classSubjects
    this.classSubjectMatters = stores.classSubjectMatters
    this.classSubjectProgress = stores.classSubjectProgress
    this.activities = stores.activities
    this.activityEnrollments = stores.activityEnrollments
    this.classActivityEnrollments = stores.classActivityEnrollments
    this.assessments = stores.assessments
    this.assessmentResults = stores.assessmentResults
    this.gradeScales = stores.gradeScales
    this.definitions = stores.definitions
    this.sections = stores.sections
    this.results = stores.results
    this.students = stores.students
    this.subjectEnrollments = stores.subjectEnrollments
    this.enrollments = stores.enrollments
    this.guardians = stores.guardians
    this.guardianLinks = stores.guardianLinks
    this.studentNotes = stores.studentNotes
    this.studentPhotoSubmissions = stores.studentPhotoSubmissions
    this.studentHealthProfiles = stores.studentHealthProfiles
    this.studentDisciplinaryActions = stores.studentDisciplinaryActions
    this.disciplinaryActions = stores.disciplinaryActions
    this.studentIncidentInvolvements = stores.studentIncidentInvolvements
    this.incidents = stores.incidents
    this.documentIssuances = stores.documentIssuances
    this.documentNumberSeries = createDocumentNumberSeriesStore(db)
    const familyFeedback = createFamilyFeedbackStores(db)
    this.familyFeedbackCampaigns = familyFeedback.familyFeedbackCampaigns
    this.familyFeedbackSlots = familyFeedback.familyFeedbackSlots
    this.familyFeedbackResponses = familyFeedback.familyFeedbackResponses
    this.familyFeedbackSnapshots = familyFeedback.familyFeedbackSnapshots
    this.familyFeedbackCommentReadAudit = familyFeedback.familyFeedbackCommentReadAudit

    this.staffPermissionAssignments = new PostgresStaffPermissionAssignmentStore(db)

    this.schools = this.schoolsStore
  }

  async init(options: { driver: MigrationDriver }): Promise<void> {
    await runMigrations(this.db, options)
  }

  async clearAll(): Promise<void> {
    await clearAllTables(this.db)
  }
}
