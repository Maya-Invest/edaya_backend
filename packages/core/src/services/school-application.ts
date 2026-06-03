import type { ActorMetadata } from '../authorization'
import type { SchoolRepositories } from '../ports'
import type { ServiceArgs } from '../shared/service-args'
import { SchoolService } from './school-service'

export type SchoolApplicationArgs = Omit<ServiceArgs, 'actor'>

export class SchoolApplication {
  private readonly args: SchoolApplicationArgs

  constructor(args: SchoolApplicationArgs) {
    this.args = args
  }

  get repositories(): SchoolRepositories {
    return this.args.repositories
  }

  forActor(actor: ActorMetadata): SchoolService {
    return new SchoolService({ ...this.args, actor })
  }
}
