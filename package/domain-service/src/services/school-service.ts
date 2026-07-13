import type { SchoolCommandHandlerMap } from './commands/school-command-handlers'
import type { AppShellCounts, GetAppShellCountsInput } from './queries/app-shell-counts'
import type { GetSchoolOverviewInput, SchoolOverview } from './queries/school-overview'
import type { ClassGroupTimetable, GetClassGroupTimetableInput } from './queries/timetable'
import type { ServiceArgs } from './service-args'
import type { ResolvedTimetableCell, ResolveTimetableSpaceInput } from './workflows/timetable-generation'
import { AuthorizationError, AuthorizationErrorCode, QueryOperations, ReportCardOperations, SchedulingOperations } from '@edaya/authorization'
import { BaseSchoolService } from './base-school-service'
import { createSchoolCommandHandlers } from './commands/school-command-handlers'
import { operationModule } from './entities/entity-config'
import { buildAppShellCounts } from './queries/app-shell-counts'
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
    await operationModule(QueryOperations.overdueFeesRead)(this.baseService.actor)
    return this.baseService.repositories.schools.getOverdueFeeCount(schoolId)
  }

  async getPublishedReportCardCount(schoolId: string): Promise<number> {
    this.checkActorSchool(schoolId)
    await operationModule(ReportCardOperations.read)(this.baseService.actor)
    return this.baseService.repositories.schools.getPublishedReportCardCount(schoolId)
  }

  async getSchoolOverview(input: GetSchoolOverviewInput): Promise<SchoolOverview> {
    this.checkActorSchool(input.schoolId)
    await operationModule(QueryOperations.overviewRead)(this.baseService.actor)
    return this.baseService.repositories.schools.getSchoolOverview(input)
  }

  async getAppShellCounts(input: GetAppShellCountsInput): Promise<AppShellCounts> {
    this.checkActorSchool(input.schoolId)
    await operationModule(QueryOperations.overviewRead)(this.baseService.actor)
    return buildAppShellCounts(this.baseService.repositories, input)
  }

  async getClassGroupTimetable(input: GetClassGroupTimetableInput): Promise<ClassGroupTimetable> {
    const classGroup = await this.baseService.repositories.classGroups.findById(input.classGroupId)
    if (!classGroup) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
    this.checkActorSchool(classGroup.schoolId)
    await operationModule(SchedulingOperations.timetableRead)(this.baseService.actor)
    await this.baseService.authorizationPolicy.checkClassGroupAccess(
      this.baseService.actor,
      [input.classGroupId],
    )
    return buildClassGroupTimetable(this.baseService.repositories, input)
  }

  async resolveTimetableSpace(input: ResolveTimetableSpaceInput): Promise<ResolvedTimetableCell[]> {
    const classGroup = await this.baseService.repositories.classGroups.findById(input.classGroupId)
    if (!classGroup || classGroup.schoolId !== this.baseService.actor.schoolId) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
    await operationModule(SchedulingOperations.timetableRead)(this.baseService.actor)
    await this.baseService.authorizationPolicy.checkClassGroupAccess(this.baseService.actor, [input.classGroupId])
    return resolveTimetableSpace(this.baseService.repositories, input)
  }

  private checkActorSchool(schoolId: string): void {
    if (schoolId !== this.baseService.actor.schoolId)
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}
