import type { AtomicExecutionPort, SchoolRepositories } from '../ports'
import type { ActorMetadata, AuthorizedServiceArgs } from './authorization'
import { AcademicsService } from './modules/academics'
import { AssessmentsService } from './modules/assessments'
import { BehaviorService } from './modules/behavior'
import { CommunicationsService } from './modules/communications'
import { FinanceService } from './modules/finance'
import { SchedulingService } from './modules/scheduling'
import { SetupService } from './modules/setup'
import { StudentsService } from './modules/student'
import { SchoolQueryService } from './query-services'

export interface ServiceArgs extends AuthorizedServiceArgs {
  atomicExecution: AtomicExecutionPort
  repositories: SchoolRepositories
}

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
  }
}

export class SchoolApplication {
  private readonly args: ServiceArgs

  constructor(args: ServiceArgs) {
    this.args = args
  }

  forActor(actor: ActorMetadata): SchoolHeadlessApp {
    return new SchoolHeadlessApp({ ...this.args, actor })
  }
}
