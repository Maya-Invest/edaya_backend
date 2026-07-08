import type { CoreEntityRepositories, ServiceApiKeyRepository } from '@edaya/core'

export type AuthorizationRepositories = CoreEntityRepositories & {
  readonly serviceApiKeys: ServiceApiKeyRepository
}
