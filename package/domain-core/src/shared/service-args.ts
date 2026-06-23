import type { AuthorizedServiceArgs } from '../authorization'
import type { AtomicExecutionPort, NotificationGatewayPort, SchoolRepositories } from '../ports'

export interface ServiceArgs extends AuthorizedServiceArgs {
  atomicExecution: AtomicExecutionPort
  repositories: SchoolRepositories
  notificationGateway: NotificationGatewayPort
}
