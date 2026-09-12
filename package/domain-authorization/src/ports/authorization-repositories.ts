import type { CoreEntityRepositories, PlatformUserRepository, S2sClientRepository, ServiceApiKeyRepository } from '@edaya/core'

export type AuthorizationRepositories = CoreEntityRepositories & {
  readonly serviceApiKeys: ServiceApiKeyRepository
  readonly platformUsers: PlatformUserRepository
  readonly s2sClients: S2sClientRepository
}
