import type { AuthorizedServiceArgs } from '../authorization'
import type { AtomicExecutionPort, SchoolRepositories } from '../ports'

export interface ServiceArgs extends AuthorizedServiceArgs {
  atomicExecution: AtomicExecutionPort
  repositories: SchoolRepositories
}
