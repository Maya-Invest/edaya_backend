import type { AtomicExecutionPort } from '../../ports/atomic-execution'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { AuthorizedServiceArgs } from '../authorization/authorization-policy'

export interface ServiceArgs extends AuthorizedServiceArgs {
  atomicExecution: AtomicExecutionPort
  repositories: SchoolRepositories
}
