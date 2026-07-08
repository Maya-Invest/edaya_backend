import type { ActorMetadata } from '@edaya/authorization'
import type { FileStoragePort } from '@edaya/core'
import type { SchoolRepositories } from '../ports/school-repositories'
import type { ServiceArgs } from './service-args'
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

  get fileStorage(): FileStoragePort {
    return this.args.fileStorage
  }

  forActor(actor: ActorMetadata): SchoolService {
    return new SchoolService({ ...this.args, actor })
  }

  async hasAuthAccountForEmail(email: string): Promise<boolean> {
    const resolver = this.args.authContactResolver
    if (!resolver?.hasAccountForEmail) {
      return false
    }
    return resolver.hasAccountForEmail(email)
  }
}
