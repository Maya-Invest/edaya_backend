import type { SchoolRepositories } from './ports/school-repositories'
import type { AtomicExecutionPort } from './ports/atomic-execution'
import type { ActorMetadata, AuthorizationPolicy } from './services/authorization'
import { AcademicsService } from './services/academics'
import { AssessmentsService } from './services/assessments'
import { CommunicationsService } from './services/communications'
import { FinanceService } from './services/finance'
import { SchoolQueryService } from './services/queries'
import { SchedulingService } from './services/scheduling'
import { SetupService } from './services/setup'
import { StudentsService } from './services/students'

export interface SchoolHeadlessAppDependencies {
  atomicExecution: AtomicExecutionPort
  repositories: SchoolRepositories
}

export interface SchoolHeadlessAppArgs extends SchoolHeadlessAppDependencies {
  actor: ActorMetadata
  authorizationPolicy: AuthorizationPolicy
}

export interface SchoolApplicationArgs extends SchoolHeadlessAppDependencies {
  authorizationPolicy: AuthorizationPolicy
}

export class SchoolApplication {
  private readonly args: SchoolApplicationArgs

  constructor(args: SchoolApplicationArgs) {
    this.args = args
  }

  forActor(actor: ActorMetadata): SchoolHeadlessApp {
    return new SchoolHeadlessApp({ ...this.args, actor })
  }
}

export class SchoolHeadlessApp {
  readonly setup: SetupService
  readonly academics: AcademicsService
  readonly scheduling: SchedulingService
  readonly assessments: AssessmentsService
  readonly students: StudentsService
  readonly finance: FinanceService
  readonly communications: CommunicationsService
  readonly queries: SchoolQueryService

  constructor(args: SchoolHeadlessAppArgs) {
    this.setup = new SetupService(args)
    this.academics = new AcademicsService(args)
    this.scheduling = new SchedulingService(args)
    this.assessments = new AssessmentsService({
      ...args,
      attendanceService: this.scheduling,
    })
    this.students = new StudentsService(args)
    this.communications = new CommunicationsService(args)
    this.finance = new FinanceService(args)
    this.queries = new SchoolQueryService(args)
  }
}
