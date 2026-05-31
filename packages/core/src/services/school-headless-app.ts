import type { SchoolRepositories } from '../ports'
import type { ActorMetadata } from './authorization'
import type { ServiceArgs } from './shared/service-args'
import { AcademicsService } from './commands/academics'
import { AssessmentsService } from './commands/assessments'
import { BehaviorService } from './commands/behavior'
import { CommunicationsService } from './commands/communications'
import { FinanceService } from './commands/finance'
import { SchedulingService } from './commands/scheduling'
import { SetupService } from './commands/setup'
import { StudentsService } from './commands/student'
import { SchoolQueryService } from './queries/query-services'
import { BaseSchoolUpdateService } from './queries/update-services'

export class SchoolHeadlessApp {
  readonly setup: SetupService
  readonly academics: AcademicsService
  readonly scheduling: SchedulingService
  readonly assessments: AssessmentsService
  readonly behavior: BehaviorService
  readonly students: StudentsService
  readonly finance: FinanceService
  readonly communications: CommunicationsService
  readonly queries: SchoolQueryService
  readonly commands: BaseSchoolUpdateService

  constructor(args: ServiceArgs) {
    this.setup = new SetupService(args)
    this.students = new StudentsService(args)
    this.academics = new AcademicsService(args)
    this.behavior = new BehaviorService(args)
    this.scheduling = new SchedulingService(args)
    this.assessments = new AssessmentsService(args)
    this.communications = new CommunicationsService(args)
    this.finance = new FinanceService(args)
    this.queries = new SchoolQueryService(args)
    this.commands = new BaseSchoolUpdateService(args)
  }
}

export class SchoolApplication {
  private readonly args: ServiceArgs

  constructor(args: ServiceArgs) {
    this.args = args
  }

  get repositories(): SchoolRepositories {
    return this.args.repositories
  }

  forActor(actor: ActorMetadata): SchoolHeadlessApp {
    return new SchoolHeadlessApp({ ...this.args, actor })
  }
}
