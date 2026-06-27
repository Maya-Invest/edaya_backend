import type { ActorMetadata } from '../authorization'
import type { FileStoragePort, SchoolRepositories } from '../ports'
import type { ServiceArgs } from '../shared/service-args'
import { noOpFileStorage } from '../storage/no-op-file-storage'
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
    return this.args.fileStorage ?? noOpFileStorage
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
