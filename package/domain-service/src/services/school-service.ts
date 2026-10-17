import type { SchoolCommandHandlerMap } from './commands/school-command-handlers'
import type { AppShellCounts, GetAppShellCountsInput } from './queries/app-shell-counts'
import type { MarksQueueInput } from './queries/marks-review'
import type { GetSchoolOverviewInput, SchoolOverview } from './queries/school-overview'
import type { ClassGroupTimetable, GetClassGroupTimetableInput, GetTeacherTimetableInput, TeacherTimetable } from './queries/timetable'
import type { ServiceArgs } from './service-args'
import type { ResolvedTimetableCell, ResolveTimetableSpaceInput } from './workflows/timetable-generation'
import { AuthorizationError, AuthorizationErrorCode, requireActorSchoolId } from '@edaya/authorization'
import { ReportCardResultStatus, StudentPhotoSubmissionStatus } from '@edaya/core'
import { BaseSchoolService } from './base-school-service'
import { createSchoolCommandHandlers } from './commands/school-command-handlers'
import { getActivityRoster } from './queries/activity-roster'
import { getAssessmentEditorContext } from './queries/assessment-editor-context'
import { getAssessmentMarksReview, listAssessmentMarksReviews } from './queries/marks-review'

import { buildSchoolOverview } from './queries/school-overview'
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
import { SchedulingServiceWorkflow } from './workflows/scheduling'
import { SetupServiceWorkflow } from './workflows/setup'
import { StudentServiceWorkflow } from './workflows/student'
import { TeacherCorrectionsWorkflow } from './workflows/teacher-corrections'
import { resolveTimetableSpace, TimetableGenerationServiceWorkflow } from './workflows/timetable-generation'

export class SchoolService {
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

  listConversationRecipients(input: Parameters<ConversationsWorkflow['recipients']>[0]) { return this.conversationsWorkflow.recipients(input) }
  listConversations(input: Parameters<ConversationsWorkflow['list']>[0]) { return this.conversationsWorkflow.list(input) }
  getConversation(input: Parameters<ConversationsWorkflow['detail']>[0]) { return this.conversationsWorkflow.detail(input) }

  async getTeacherAttendanceCall(input: Parameters<TeacherCorrectionsWorkflow['getAttendanceCall']>[0]) { return this.teacherCorrectionsWorkflow.getAttendanceCall(input) }
  async getTeacherWorkflowState(input: Parameters<TeacherCorrectionsWorkflow['getWorkflowState']>[0]) { return this.teacherCorrectionsWorkflow.getWorkflowState(input) }
  async listTeacherCorrections(input: Parameters<TeacherCorrectionsWorkflow['list']>[0]) { return this.teacherCorrectionsWorkflow.list(input) }
  async getTeacherCorrection(input: { correctionId: string }) { return this.teacherCorrectionsWorkflow.detail(input) }

  async getActivityRoster(input: { activityId: string }) { return getActivityRoster(this.baseService, input) }

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

  listGuardianFamilyFeedbackCampaigns() {
    return this.familyFeedbackWorkflow.listGuardianFamilyFeedbackCampaigns()
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
    await this.baseService.access.overview.assertContext(input)
    return this.baseService.repositories.dashboardProjections.appShell(input, await this.baseService.access.overview.scopes())
  }

  async getClassGroupTimetable(input: GetClassGroupTimetableInput): Promise<ClassGroupTimetable> {
    const repositories = await this.baseService.access.timetable.eventRepositories(input.classGroupId)
    return buildClassGroupTimetable(repositories, input)
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
