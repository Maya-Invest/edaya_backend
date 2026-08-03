import type { CoreEntityRepositories, Consortium, ServiceApiKeyRepository, BaseRepositoryInterface } from '@edaya/core'

export type AuthorizationRepositories = CoreEntityRepositories & {
  readonly serviceApiKeys: ServiceApiKeyRepository
  readonly consortiums?: BaseRepositoryInterface<Consortium>
}
