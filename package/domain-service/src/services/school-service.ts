import type { StaffActivityListFilter, StaffActivityListInput, StaffFeedbackHistoryFilter, StaffFeedbackHistoryInput, StaffFeedbackOptionsInput, TeacherIncidentDetailInput, TeacherIncidentsInput, TeacherLogbookInput } from '@edaya/core'
import type { SchoolCommandHandlerMap } from './commands/school-command-handlers'
import type { AppShellCounts, GetAppShellCountsInput } from './queries/app-shell-counts'
import type { MarksQueueInput } from './queries/marks-review'
import type { GetSchoolOverviewInput, SchoolOverview } from './queries/school-overview'
import type { SessionHistoryInput } from './queries/session-history'
import type { ClassGroupTimetable, GetClassGroupTimetableInput, GetTeacherTimetableInput, TeacherTimetable } from './queries/timetable'
import type { ServiceArgs } from './service-args'
import type { ResolvedTimetableCell, ResolveTimetableSpaceInput } from './workflows/timetable-generation'
import { AuthorizationError, AuthorizationErrorCode, requireActorSchoolId } from '@edaya/authorization'
import { ReportCardResultStatus, StudentPhotoSubmissionStatus } from '@edaya/core'
import { SchoolImportService } from '../capabilities/imports/import-service'
import { BaseSchoolService } from './base-school-service'
import { createSchoolCommandHandlers } from './commands/school-command-handlers'
import { getActivityRoster } from './queries/activity-roster'
import { getAssessmentEditorContext } from './queries/assessment-editor-context'
import { readClassReportRoster } from './queries/class-report-roster'
import { getDeliveryInbox } from './queries/delivery-inbox'
import { readStaffFeedbackOptions, readTeacherFeedbackSummaries } from './queries/family-feedback-lists'
import { readGuardianChildPhoto, readGuardianPapers } from './queries/guardian-child-profile'
import { readGuardianChoices, readGuardianHighlights } from './queries/guardian-home'
import { getGuardianOccurrenceDetail } from './queries/guardian-occurrence'
import { getGuardianFeesSummary, getGuardianPaymentDetail, getGuardianSettlements } from './queries/guardian-payment'
import { getGuardianAssessmentResult, getGuardianPeriodOverview, getGuardianPeriodResults, getGuardianSubjectMarks } from './queries/guardian-period-results'
import { readIncidentLessonOptions } from './queries/incident-lesson-options'
import { getAssessmentMarksReview, listAssessmentMarksReviews } from './queries/marks-review'
import { buildSchoolOverview } from './queries/school-overview'
import { getStudentSessionHistory, getTeacherSessionHistory } from './queries/session-history'
import { exportStaffActivityList, readStaffActivityList, readStaffActivityProfile } from './queries/staff-activity-list'
import { readStaffActivityMembers, readStaffActivityPupilOptions } from './queries/staff-activity-pupils'
import { exportStaffFeedbackHistory, readStaffFeedbackHistory } from './queries/staff-feedback-history'
import { readClassRosterMemberIds, readStudentDirectory, revalidateStudentDirectory } from './queries/student-directory'
import { getStudentAttendanceHistory, getStudentGradeHistory } from './queries/student-history'
import { getClassSubjectRoster, getStudentSubjectEnrollments, getStudentTimetable } from './queries/subject-enrollment'
import { getTeacherIncidentDetail, getTeacherIncidents } from './queries/teacher-incidents'
import { getTeacherLogbook } from './queries/teacher-logbook'
import { getTeacherSubjectPeriodSummary } from './queries/teacher-subject-period-summary'

import { buildClassGroupTimetable, buildTeacherTimetable } from './queries/timetable'
import { AcademicsServiceWorkflow } from './workflows/academics'
import { AccessControlServiceWorkflow } from './workflows/access-control'
import { AccountInvitationServiceWorkflow } from './workflows/account-invitation'
import { AssessmentsServiceWorkflow } from './workflows/assessments'
import { BehaviorServiceWorkflow } from './workflows/behavior'
import { CommunicationsServiceWorkflow } from './workflows/communications'
import { ConversationsWorkflow } from './workflows/conversations'
import { DocumentsServiceWorkflow } from './workflows/documents'
import { FamilyFeedbackServiceWorkflow } from './workflows/family-feedback'
import { FinanceServiceWorkflow } from './workflows/finance'
import { NotificationTemplatesServiceWorkflow } from './workflows/notification-templates'
import { ReportConfigurationWorkflow } from './workflows/report-configuration'
import { SchedulingServiceWorkflow } from './workflows/scheduling'
import { SetupServiceWorkflow } from './workflows/setup'
import { StudentServiceWorkflow } from './workflows/student'
import { TeacherCorrectionsWorkflow } from './workflows/teacher-corrections'
import { resolveTimetableSpace, TimetableGenerationServiceWorkflow } from './workflows/timetable-generation'

export class SchoolService {
  private readonly importArgs: Pick<ServiceArgs, 'importPersistence' | 'importFormat' | 'durableWork'>
  get imports(): SchoolImportService {
    if (!this.importArgs.importPersistence || !this.importArgs.importFormat)
      throw new Error('Import adapters are not configured')
    return new SchoolImportService(this, this.importArgs.importPersistence, this.importArgs.importFormat, this.importArgs.durableWork)
  }

  readonly baseService: BaseSchoolService
  readonly academicsWorkflow: AcademicsServiceWorkflow
  readonly financeWorkflow: FinanceServiceWorkflow
  readonly assessmentsWorkflow: AssessmentsServiceWorkflow
  readonly studentWorkflow: StudentServiceWorkflow
  readonly schedulingWorkflow: SchedulingServiceWorkflow
  readonly timetableGenerationWorkflow: TimetableGenerationServiceWorkflow
  readonly setupWorkflow: SetupServiceWorkflow
  readonly communicationsWorkflow: CommunicationsServiceWorkflow
  readonly behaviorWorkflow: BehaviorServiceWorkflow
  readonly accessControlWorkflow: AccessControlServiceWorkflow
  readonly accountInvitationWorkflow: AccountInvitationServiceWorkflow
  readonly notificationTemplatesWorkflow: NotificationTemplatesServiceWorkflow
  readonly documentsWorkflow: DocumentsServiceWorkflow
  readonly familyFeedbackWorkflow: FamilyFeedbackServiceWorkflow
  readonly teacherCorrectionsWorkflow: TeacherCorrectionsWorkflow
  readonly conversationsWorkflow: ConversationsWorkflow
  readonly commands: SchoolCommandHandlerMap

  constructor(args: ServiceArgs) {
    this.importArgs = args
    this.baseService = new BaseSchoolService(args)
    this.academicsWorkflow = new AcademicsServiceWorkflow(this.baseService)
    this.financeWorkflow = new FinanceServiceWorkflow(this.baseService)
    this.assessmentsWorkflow = new AssessmentsServiceWorkflow(this.baseService)
    this.studentWorkflow = new StudentServiceWorkflow(this.baseService)
    this.schedulingWorkflow = new SchedulingServiceWorkflow(this.baseService)
    this.timetableGenerationWorkflow = new TimetableGenerationServiceWorkflow(this.baseService)
    this.setupWorkflow = new SetupServiceWorkflow(this.baseService)
    this.communicationsWorkflow = new CommunicationsServiceWorkflow(this.baseService)
    this.behaviorWorkflow = new BehaviorServiceWorkflow(this.baseService)
    this.accessControlWorkflow = new AccessControlServiceWorkflow(this.baseService)
    this.accountInvitationWorkflow = new AccountInvitationServiceWorkflow(this.baseService)
    this.notificationTemplatesWorkflow = new NotificationTemplatesServiceWorkflow(this.baseService)
    this.documentsWorkflow = new DocumentsServiceWorkflow(this.baseService)
    this.familyFeedbackWorkflow = new FamilyFeedbackServiceWorkflow(this.baseService)
    this.teacherCorrectionsWorkflow = new TeacherCorrectionsWorkflow(this.baseService)
    this.conversationsWorkflow = new ConversationsWorkflow(this.baseService)
    this.commands = createSchoolCommandHandlers({
      conversations: this.conversationsWorkflow,
      teacherCorrections: this.teacherCorrectionsWorkflow,
      setup: this.setupWorkflow,
      accessControl: this.accessControlWorkflow,
      accountInvitation: this.accountInvitationWorkflow,
      notificationTemplates: this.notificationTemplatesWorkflow,
      academics: this.academicsWorkflow,
      assessments: this.assessmentsWorkflow,
      student: this.studentWorkflow,
      scheduling: this.schedulingWorkflow,
      timetableGeneration: this.timetableGenerationWorkflow,
      communications: this.communicationsWorkflow,
      behavior: this.behaviorWorkflow,
      finance: this.financeWorkflow,
      documents: this.documentsWorkflow,
      familyFeedback: this.familyFeedbackWorkflow,
    })
  }

  getReportConfiguration(input: Parameters<ReportConfigurationWorkflow['read']>[0]) { return new ReportConfigurationWorkflow(this.baseService).read(input) }

  getStudentSubjectEnrollments(input: Parameters<typeof getStudentSubjectEnrollments>[1]) { return getStudentSubjectEnrollments(this.baseService, input) }
  getClassSubjectRoster(input: Parameters<typeof getClassSubjectRoster>[1]) { return getClassSubjectRoster(this.baseService, input) }
  getStudentTimetable(input: Parameters<typeof getStudentTimetable>[1]) { return getStudentTimetable(this.baseService, input) }

  listTeacherGuardianRecipients(input: Parameters<ConversationsWorkflow['guardianRecipients']>[0]) { return this.conversationsWorkflow.guardianRecipients(input) }
  listConversationRecipients(input: Parameters<ConversationsWorkflow['recipients']>[0]) { return this.conversationsWorkflow.recipients(input) }
  getStudentAttendanceHistory(input: Parameters<typeof getStudentAttendanceHistory>[1]) { return getStudentAttendanceHistory(this.baseService, input) }
  getStudentGradeHistory(input: Parameters<typeof getStudentGradeHistory>[1]) { return getStudentGradeHistory(this.baseService, input) }
  getDeliveryInbox(input: Parameters<typeof getDeliveryInbox>[1]) { return getDeliveryInbox(this.baseService, input) }
  getUnreadConversationCount() { return this.conversationsWorkflow.unreadCount() }
  getUnresolvedConversationCount() { return this.conversationsWorkflow.unresolvedCount() }
  listConversations(input: Parameters<ConversationsWorkflow['list']>[0]) { return this.conversationsWorkflow.list(input) }
  getConversation(input: Parameters<ConversationsWorkflow['detail']>[0]) { return this.conversationsWorkflow.detail(input) }

  async getTeacherAttendanceCall(input: Parameters<TeacherCorrectionsWorkflow['getAttendanceCall']>[0]) { return this.teacherCorrectionsWorkflow.getAttendanceCall(input) }
  getTeacherDailyAttendanceStatus(input: Parameters<TeacherCorrectionsWorkflow['getDailyAttendanceStatus']>[0]) { return this.teacherCorrectionsWorkflow.getDailyAttendanceStatus(input) }
  async getTeacherWorkflowState(input: Parameters<TeacherCorrectionsWorkflow['getWorkflowState']>[0]) { return this.teacherCorrectionsWorkflow.getWorkflowState(input) }
  async listTeacherCorrections(input: Parameters<TeacherCorrectionsWorkflow['list']>[0]) { return this.teacherCorrectionsWorkflow.list(input) }
  async getTeacherCorrection(input: { correctionId: string }) { return this.teacherCorrectionsWorkflow.detail(input) }

  async getActivityRoster(input: { activityId: string, includeMemberships?: boolean }) {
    return this.baseService.atomicExecution.execute(() => getActivityRoster(this.baseService, input), { readSnapshot: true })
  }

  async getGuardianAssessmentResult(input: { studentId: string, assessmentId: string }) { return getGuardianAssessmentResult(this.baseService, input) }
  getGuardianPeriodOverview(input: Parameters<typeof getGuardianPeriodOverview>[1]) { return getGuardianPeriodOverview(this.baseService, input) }
  getGuardianSubjectMarks(input: Parameters<typeof getGuardianSubjectMarks>[1]) { return getGuardianSubjectMarks(this.baseService, input) }
  async getGuardianPeriodResults(input: { studentId: string, periodId: string }) { return getGuardianPeriodResults(this.baseService, input) }

  async getTeacherSubjectPeriodSummary(input: { classSubjectId: string, periodId: string }) { return this.baseService.atomicExecution.execute(() => getTeacherSubjectPeriodSummary(this.baseService, input), { readSnapshot: true }) }

  async getAssessmentEditorContext(input: { classGroupId: string, periodId: string }) { return getAssessmentEditorContext(this.baseService, input) }

  async getAssessmentMarksReview(input: { assessmentId: string }) { return getAssessmentMarksReview(this.baseService, input) }
  async listAssessmentMarksReviews(input: MarksQueueInput) { return listAssessmentMarksReviews(this.baseService, input) }

  async getOverdueFeeCount(schoolId: string): Promise<number> {
    this.checkActorSchool(schoolId)
    return this.financeWorkflow.countOverdueCharges()
  }

  getStudentFinanceSummary(input: { studentId: string, academicYearId: string }) {
    return this.financeWorkflow.getStudentFinanceSummary(input)
  }

  getAccountStatement(input: { accountId: string }) {
    return this.financeWorkflow.getAccountStatement(input)
  }

  getSchoolFinanceAging(input: { schoolId: string, academicYearId?: string }) {
    this.checkActorSchool(input.schoolId)
    return this.financeWorkflow.getSchoolFinanceAging(input)
  }

  getFinanceOverview(input: Parameters<FinanceServiceWorkflow['getFinanceOverview']>[0]) { return this.financeWorkflow.getFinanceOverview(input) }

  getFeeFinanceOverview(input: Parameters<FinanceServiceWorkflow['getFeeFinanceOverview']>[0]) { return this.financeWorkflow.getFeeFinanceOverview(input) }

  getFinanceBillingPage(input: Parameters<FinanceServiceWorkflow['getFinanceBillingPage']>[0]) { return this.financeWorkflow.getFinanceBillingPage(input) }

  getFinancePaymentsPage(input: Parameters<FinanceServiceWorkflow['getFinancePaymentsPage']>[0]) { return this.financeWorkflow.getFinancePaymentsPage(input) }

  getFinanceBillingDetail(input: Parameters<FinanceServiceWorkflow['getFinanceBillingDetail']>[0]) { return this.financeWorkflow.getFinanceBillingDetail(input) }

  getFinanceReconciliation(input: { schoolId: string, academicYearId?: string }) {
    this.checkActorSchool(input.schoolId)
    return this.financeWorkflow.getFinanceReconciliation(input)
  }

  previewAccountAllocation(input: { accountId: string, allocation: import('./workflows/finance').AllocationPlan }) {
    return this.financeWorkflow.previewAccountAllocation(input)
  }

  getRelatedFamilyFinanceOverview(input: { academicYearId: string }) {
    return this.financeWorkflow.getRelatedFamilyFinanceOverview(input)
  }

  getStudentAccountStatement(input: { studentId: string, academicYearId: string, currency?: string }) {
    return this.financeWorkflow.getStudentAccountStatement(input)
  }

  listOpenDueCharges(input: { schoolId: string, academicYearId?: string }) {
    this.checkActorSchool(input.schoolId)
    return this.financeWorkflow.listOpenDueCharges(input)
  }

  getPaymentSettlementHistory(input: { accountId: string }) {
    return this.financeWorkflow.getPaymentSettlementHistory(input)
  }

  getGuardianOccurrenceDetail(input: Parameters<typeof getGuardianOccurrenceDetail>[1]) { return getGuardianOccurrenceDetail(this.baseService, input) }

  getGuardianFeesSummary(input: Parameters<typeof getGuardianFeesSummary>[1]) { return getGuardianFeesSummary(this.baseService, input) }
  getGuardianSettlements(input: Parameters<typeof getGuardianSettlements>[1]) { return getGuardianSettlements(this.baseService, input) }

  getGuardianPaymentDetail(input: Parameters<typeof getGuardianPaymentDetail>[1]) {
    return getGuardianPaymentDetail(this.baseService, input)
  }

  listDocumentTemplates() {
    return this.documentsWorkflow.listDocumentTemplates()
  }

  listDocumentIssuances(input: Parameters<DocumentsServiceWorkflow['listDocumentIssuances']>[0]) {
    return this.documentsWorkflow.listDocumentIssuances(input)
  }

  getDocumentIssuance(input: { id: string }) {
    return this.documentsWorkflow.getDocumentIssuance(input)
  }

  grantDocumentDownload(input: { id: string }) {
    return this.documentsWorkflow.grantDocumentDownload(input)
  }

  grantDocumentBundleDownload(input: Parameters<DocumentsServiceWorkflow['grantDocumentBundleDownload']>[0]) {
    return this.documentsWorkflow.grantDocumentBundleDownload(input)
  }

  getTeacherIncidents(input: TeacherIncidentsInput) { return getTeacherIncidents(this.baseService, input) }
  getTeacherIncidentDetail(input: TeacherIncidentDetailInput) { return getTeacherIncidentDetail(this.baseService, this.teacherCorrectionsWorkflow, input) }
  getTeacherLogbook(input: TeacherLogbookInput) { return getTeacherLogbook(this.baseService, input) }

  getGuardianChildPhoto(input: Parameters<typeof readGuardianChildPhoto>[1]) {
    return readGuardianChildPhoto(this.baseService, input)
  }

  getGuardianPapers(input: Parameters<typeof readGuardianPapers>[1]) {
    return readGuardianPapers(this.baseService, input)
  }

  getClassReportRoster(input: Parameters<typeof readClassReportRoster>[1]) {
    return readClassReportRoster(this.baseService, input)
  }

  getStaffActivityMembers(input: Parameters<typeof readStaffActivityMembers>[1]) {
    return readStaffActivityMembers(this.baseService, input)
  }

  getStaffActivityPupilOptions(input: Parameters<typeof readStaffActivityPupilOptions>[1]) {
    return readStaffActivityPupilOptions(this.baseService, input)
  }

  getIncidentLessonOptions(input: Parameters<typeof readIncidentLessonOptions>[1]) {
    return readIncidentLessonOptions(this.baseService, input)
  }

  getStaffActivityProfile(input: { activityId: string }) {
    return readStaffActivityProfile(this.baseService, input.activityId)
  }

  getStaffActivityList(input: StaffActivityListInput) {
    return readStaffActivityList(this.baseService, input)
  }

  getStaffActivityListExport(input: StaffActivityListFilter) {
    return exportStaffActivityList(this.baseService, input)
  }

  getStaffFeedbackHistory(input: StaffFeedbackHistoryInput) {
    return readStaffFeedbackHistory(this.baseService, input)
  }

  getStaffFeedbackHistoryExport(input: StaffFeedbackHistoryFilter) {
    return exportStaffFeedbackHistory(this.baseService, input)
  }

  getStaffFeedbackOptions(input: StaffFeedbackOptionsInput) {
    return readStaffFeedbackOptions(this.baseService, input)
  }

  getStaffFeedbackCampaigns(input: { academicYearId?: string, campaignId?: string }) {
    return this.familyFeedbackWorkflow.getStaffFeedbackCampaigns(input)
  }

  listFamilyFeedbackCampaigns() {
    return this.familyFeedbackWorkflow.listFamilyFeedbackCampaigns()
  }

  getFamilyFeedbackCampaign(input: { id: string }) {
    return this.familyFeedbackWorkflow.getFamilyFeedbackCampaign(input)
  }

  previewFamilyFeedbackAudience(input: Parameters<FamilyFeedbackServiceWorkflow['previewFamilyFeedbackAudience']>[0]) {
    return this.familyFeedbackWorkflow.previewFamilyFeedbackAudience(input)
  }

  getFamilyFeedbackInstrument(input: Parameters<FamilyFeedbackServiceWorkflow['getFamilyFeedbackInstrument']>[0]) {
    return this.familyFeedbackWorkflow.getFamilyFeedbackInstrument(input)
  }

  listGuardianFamilyFeedbackCampaigns(input: { studentId?: string } = {}) {
    return this.familyFeedbackWorkflow.listGuardianFamilyFeedbackCampaigns(input)
  }

  getGuardianFamilyFeedbackQuestionnaire(input: Parameters<FamilyFeedbackServiceWorkflow['getGuardianFamilyFeedbackQuestionnaire']>[0]) {
    return this.familyFeedbackWorkflow.getGuardianFamilyFeedbackQuestionnaire(input)
  }

  listFamilyFeedbackComments(input: { id: string }) {
    return this.familyFeedbackWorkflow.listFamilyFeedbackComments(input)
  }

  getFamilyFeedbackAggregateReview(input: { id: string }) {
    return this.familyFeedbackWorkflow.getFamilyFeedbackAggregateReview(input)
  }

  listTeacherFamilyFeedbackResults() {
    return this.familyFeedbackWorkflow.listTeacherFamilyFeedbackResults()
  }

  getTeacherFamilyFeedbackResult(input: { id: string }) {
    return this.familyFeedbackWorkflow.getTeacherFamilyFeedbackResult(input)
  }

  reconcileStudentYearAccount(input: { accountId: string }) {
    return this.financeWorkflow.reconcileStudentYearAccount(input)
  }

  reconcileSchoolFinance(input: { schoolId: string, academicYearId?: string }) {
    this.checkActorSchool(input.schoolId)
    return this.financeWorkflow.reconcileSchoolFinance(input)
  }

  async getPublishedReportCardCount(schoolId: string): Promise<number> {
    this.checkActorSchool(schoolId)
    const scope = await this.baseService.access.reportCards.readScope()
    return this.baseService.repositories.results.forAccess(scope).count({ status: ReportCardResultStatus.Published })
  }

  getGuardianHighlights(input: import('@edaya/core').GuardianHighlightsInput) { return readGuardianHighlights(this.baseService, input) }
  getGuardianChildChoices() { return readGuardianChoices(this.baseService) }
  getTeacherFeedbackSummaries(input: import('@edaya/core').TeacherFeedbackSelection) { return readTeacherFeedbackSummaries(this.baseService, input) }

  async revalidateStudentDirectory(input: import('@edaya/core').StudentDirectoryInput, ifNoneMatch?: string) {
    return revalidateStudentDirectory(this.baseService, input, ifNoneMatch)
  }

  async getClassRosterMemberIds(input: import('@edaya/core').ClassRosterMembersInput) {
    return readClassRosterMemberIds(this.baseService, input)
  }

  async getStudentDirectory(input: import('@edaya/core').StudentDirectoryInput) {
    return readStudentDirectory(this.baseService, input)
  }

  async getSchoolOverview(input: GetSchoolOverviewInput): Promise<SchoolOverview> {
    this.checkActorSchool(input.schoolId)
    await this.baseService.access.overview.assertContext(input)
    let pendingStudentPhotoCount = 0
    try {
      pendingStudentPhotoCount = await this.baseService.entities.studentPhotoSubmissions.count({
        status: StudentPhotoSubmissionStatus.Pending,
      })
    }
    catch (error) {
      if (!(error instanceof AuthorizationError))
        throw error
    }
    return buildSchoolOverview(this.baseService.repositories.dashboardProjections, await this.baseService.access.overview.scopes(), input, { pendingStudentPhotoCount })
  }

  async getAppShellCounts(input: GetAppShellCountsInput): Promise<AppShellCounts> {
    this.checkActorSchool(input.schoolId)
    const base = this.baseService
    return base.atomicExecution.execute(async () => {
      const scopes = await base.access.overview.shellScopes(input)
      return base.repositories.dashboardProjections.appShell(input, scopes)
    }, { readSnapshot: true })
  }

  async getClassGroupTimetable(input: GetClassGroupTimetableInput): Promise<ClassGroupTimetable> {
    const repositories = await this.baseService.access.timetable.eventRepositories(input.classGroupId)
    return buildClassGroupTimetable(repositories, input)
  }

  getStudentSessionHistory(input: SessionHistoryInput & { studentId: string }) {
    return getStudentSessionHistory(this.baseService, input)
  }

  getTeacherSessionHistory(input: SessionHistoryInput & { teacherId: string, classGroupId?: string, classSubjectId?: string }) {
    return getTeacherSessionHistory(this.baseService, input)
  }

  async getTeacherTimetable(input: GetTeacherTimetableInput): Promise<TeacherTimetable> {
    const repositories = await this.baseService.access.timetable.teacherEventRepositories(input.teacherId)
    return buildTeacherTimetable(repositories, input)
  }

  async resolveTimetableSpace(input: ResolveTimetableSpaceInput): Promise<ResolvedTimetableCell[]> {
    const repositories = await this.baseService.access.timetable.spaceRepositories(input)
    return resolveTimetableSpace(repositories, input)
  }

  private checkActorSchool(schoolId: string): void {
    if (schoolId !== requireActorSchoolId(this.baseService.actor))
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}
