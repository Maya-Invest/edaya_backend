import type { GetSchoolOverviewInput, SchoolOverview } from '../queries/school-overview'
import type { ServiceArgs } from '../shared/service-args'
import type { SchoolCommandHandlerMap } from './school-command-handlers'
import { AuthorizationError, AuthorizationErrorCode, Permission } from '../authorization'
import { permissionAction } from '../shared'
import { BaseSchoolService } from './base-school-service'
import { createSchoolCommandHandlers } from './school-command-handlers'
import { AcademicsServiceWorkflow } from './service-workflows/academics'
import { AccessControlServiceWorkflow } from './service-workflows/access-control'
import { AssessmentsServiceWorkflow } from './service-workflows/assessments'
import { BehaviorServiceWorkflow } from './service-workflows/behavior'
import { CommunicationsServiceWorkflow } from './service-workflows/communications'
import { FinanceServiceWorkflow } from './service-workflows/finance'
import { SchedulingServiceWorkflow } from './service-workflows/scheduling'
import { SetupServiceWorkflow } from './service-workflows/setup'
import { StudentServiceWorkflow } from './service-workflows/student'

export class SchoolService {
  readonly baseService: BaseSchoolService
  readonly academicsWorkflow: AcademicsServiceWorkflow
  readonly financeWorkflow: FinanceServiceWorkflow
  readonly assessmentsWorkflow: AssessmentsServiceWorkflow
  readonly studentWorkflow: StudentServiceWorkflow
  readonly schedulingWorkflow: SchedulingServiceWorkflow
  readonly setupWorkflow: SetupServiceWorkflow
  readonly communicationsWorkflow: CommunicationsServiceWorkflow
  readonly behaviorWorkflow: BehaviorServiceWorkflow
  readonly accessControlWorkflow: AccessControlServiceWorkflow
  readonly commands: SchoolCommandHandlerMap

  constructor(args: ServiceArgs) {
    this.baseService = new BaseSchoolService(args)
    this.academicsWorkflow = new AcademicsServiceWorkflow(this.baseService)
    this.financeWorkflow = new FinanceServiceWorkflow(this.baseService)
    this.assessmentsWorkflow = new AssessmentsServiceWorkflow(this.baseService)
    this.studentWorkflow = new StudentServiceWorkflow(this.baseService)
    this.schedulingWorkflow = new SchedulingServiceWorkflow(this.baseService)
    this.setupWorkflow = new SetupServiceWorkflow(this.baseService)
    this.communicationsWorkflow = new CommunicationsServiceWorkflow(this.baseService)
    this.behaviorWorkflow = new BehaviorServiceWorkflow(this.baseService)
    this.accessControlWorkflow = new AccessControlServiceWorkflow(this.baseService)
    this.commands = createSchoolCommandHandlers({
      setup: this.setupWorkflow,
      accessControl: this.accessControlWorkflow,
      academics: this.academicsWorkflow,
      assessments: this.assessmentsWorkflow,
      student: this.studentWorkflow,
      scheduling: this.schedulingWorkflow,
      communications: this.communicationsWorkflow,
      behavior: this.behaviorWorkflow,
      finance: this.financeWorkflow,
    })
  }

  async getOverdueFeeCount(schoolId: string): Promise<number> {
    this.checkActorSchool(schoolId)
    permissionAction(Permission.QUERY_OVERDUE_FEES_READ)(this.baseService.actor)
    return this.baseService.repositories.schools.getOverdueFeeCount(schoolId)
  }

  async getPublishedReportCardCount(schoolId: string): Promise<number> {
    this.checkActorSchool(schoolId)
    permissionAction(Permission.QUERY_REPORT_CARD_DETAIL_READ)(this.baseService.actor)
    return this.baseService.repositories.schools.getPublishedReportCardCount(schoolId)
  }

  async getSchoolOverview(input: GetSchoolOverviewInput): Promise<SchoolOverview> {
    this.checkActorSchool(input.schoolId)
    permissionAction(Permission.QUERY_OVERVIEW_READ)(this.baseService.actor)
    return this.baseService.repositories.schools.getSchoolOverview(input)
  }

  private checkActorSchool(schoolId: string): void {
    if (schoolId !== this.baseService.actor.schoolId)
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}
