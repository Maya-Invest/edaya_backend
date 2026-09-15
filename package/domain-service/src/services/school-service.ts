import type { SchoolCommandHandlerMap } from './commands/school-command-handlers'
import type { AppShellCounts, GetAppShellCountsInput } from './queries/app-shell-counts'
import type { GetSchoolOverviewInput, SchoolOverview } from './queries/school-overview'
import type { ClassGroupTimetable, GetClassGroupTimetableInput } from './queries/timetable'
import type { ServiceArgs } from './service-args'
import type { ResolvedTimetableCell, ResolveTimetableSpaceInput } from './workflows/timetable-generation'
import { AuthorizationError, AuthorizationErrorCode, requireActorSchoolId } from '@edaya/authorization'
import { FeeStatus, ReportCardResultStatus, StudentPhotoSubmissionStatus } from '@edaya/core'
import { BaseSchoolService } from './base-school-service'
import { createSchoolCommandHandlers } from './commands/school-command-handlers'

import { buildAppShellCounts } from './queries/app-shell-counts'
import { buildSchoolOverview } from './queries/school-overview'
import { buildClassGroupTimetable } from './queries/timetable'
import { AcademicsServiceWorkflow } from './workflows/academics'
import { AccessControlServiceWorkflow } from './workflows/access-control'
import { AccountInvitationServiceWorkflow } from './workflows/account-invitation'
import { AssessmentsServiceWorkflow } from './workflows/assessments'
import { BehaviorServiceWorkflow } from './workflows/behavior'
import { CommunicationsServiceWorkflow } from './workflows/communications'
import { FinanceServiceWorkflow } from './workflows/finance'
import { NotificationTemplatesServiceWorkflow } from './workflows/notification-templates'
import { SchedulingServiceWorkflow } from './workflows/scheduling'
import { SetupServiceWorkflow } from './workflows/setup'
import { StudentServiceWorkflow } from './workflows/student'
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
    this.commands = createSchoolCommandHandlers({
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
    })
  }

  async getOverdueFeeCount(schoolId: string): Promise<number> {
    this.checkActorSchool(schoolId)
    const scope = await this.baseService.access.finance.overdueFeesScope()
    return this.baseService.repositories.studentFees.forAccess(scope).count({ status: FeeStatus.Overdue })
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
    return buildSchoolOverview(await this.baseService.access.overview.repositories(), input, { pendingStudentPhotoCount })
  }

  async getAppShellCounts(input: GetAppShellCountsInput): Promise<AppShellCounts> {
    this.checkActorSchool(input.schoolId)
    await this.baseService.access.overview.assertContext(input)
    return buildAppShellCounts(await this.baseService.access.overview.repositories(), input)
  }

  async getClassGroupTimetable(input: GetClassGroupTimetableInput): Promise<ClassGroupTimetable> {
    const repositories = await this.baseService.access.timetable.eventRepositories(input.classGroupId)
    return buildClassGroupTimetable(repositories, input)
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
