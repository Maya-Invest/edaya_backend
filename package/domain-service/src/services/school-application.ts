import type { ActorMetadata } from '@edaya/authorization'
import type { AtomicExecutionPort, FileStoragePort } from '@edaya/core'
import type { SchoolRepositories } from '../ports/school-repositories'
import type { ServiceArgs } from './service-args'
import { AuthorizationError, AuthorizationErrorCode, isSchoolScopedActor } from '@edaya/authorization'
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

  get atomicExecution(): AtomicExecutionPort {
    if (!this.args.atomicExecution)
      throw new Error('Application writes require atomic execution')
    return this.args.atomicExecution
  }

  get fileStorage(): FileStoragePort {
    return this.args.fileStorage
  }

  forActor(actor: ActorMetadata): SchoolService {
    if (!isSchoolScopedActor(actor)) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden, 'Platform actors are not school-scoped')
    }
    return new SchoolService({ ...this.args, actor })
  }

  async hasAuthAccountForEmail(email: string): Promise<boolean> {
    const resolver = this.args.authContactResolver
    if (!resolver?.hasAccountForEmail) {
      return false
    }
    return resolver.hasAccountForEmail(email)
  }

  async hasAuthAccountForPhone(phone: string): Promise<boolean> {
    const resolver = this.args.authContactResolver
    if (!resolver?.hasAccountForPhone) {
      return false
    }
    return resolver.hasAccountForPhone(phone)
  }
}
