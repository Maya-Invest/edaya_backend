import type { ActorMetadata } from '../authorization'
import type { SchoolRepositories } from '../ports'
import type { BaseSchoolService } from '../services/base-school-service'
import type { ServiceArgs } from '../shared/service-args'
import { SchoolService } from '../services/school-service'
import { AcademicsService as SchoolAcademicsService } from './commands/academics'
import { AssessmentsService as SchoolAssessmentsService } from './commands/assessments'
import { BehaviorService as SchoolBehaviorService } from './commands/behavior'
import { CommunicationsService as SchoolCommunicationsService } from './commands/communications'
import { ConfigService as SchoolConfigService } from './commands/config'
import { FinanceService as SchoolFinanceService } from './commands/finance'
import { SchedulingService as SchoolSchedulingService } from './commands/scheduling'
import { SchoolSetupService } from './commands/setup'
import { StudentsService as SchoolStudentsService } from './commands/student'
import { SchoolQueryService } from './queries'

export class SchoolHeadlessApp {
  readonly setup: SchoolSetupService
  readonly academics: SchoolAcademicsService
  readonly scheduling: SchoolSchedulingService
  readonly assessments: SchoolAssessmentsService
  readonly behavior: SchoolBehaviorService
  readonly students: SchoolStudentsService
  readonly finance: SchoolFinanceService
  readonly communications: SchoolCommunicationsService
  readonly config: SchoolConfigService
  readonly queries: SchoolQueryService
  readonly base: BaseSchoolService
  readonly service: SchoolService

  constructor(args: ServiceArgs) {
    this.setup = new SchoolSetupService(args)
    this.students = new SchoolStudentsService(args)
    this.academics = new SchoolAcademicsService(args)
    this.behavior = new SchoolBehaviorService(args)
    this.scheduling = new SchoolSchedulingService(args)
    this.assessments = new SchoolAssessmentsService(args)
    this.communications = new SchoolCommunicationsService(args)
    this.finance = new SchoolFinanceService(args)
    this.config = new SchoolConfigService(args)
    this.queries = new SchoolQueryService(args)
    this.service = new SchoolService(args)
    this.base = this.service.base
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
