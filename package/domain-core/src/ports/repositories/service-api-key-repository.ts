import type { ServiceApiKey } from '../../domain/school/service-api-key'
import type { BaseRepositoryInterface } from './base-repository'

export interface ServiceApiKeyRepository extends BaseRepositoryInterface<ServiceApiKey> {
  findActiveByHash: (keyHash: string, now?: Date) => Promise<ServiceApiKey | undefined>
  countActiveElevatedServiceAccounts: (schoolId: string) => Promise<number>
}
