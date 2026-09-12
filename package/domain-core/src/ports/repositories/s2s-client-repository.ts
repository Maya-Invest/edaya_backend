import type { S2sClient } from '../../domain/platform/s2s-client'
import type { BaseRepositoryInterface } from './base-repository'

export interface S2sClientRepository extends BaseRepositoryInterface<S2sClient> {
  findActiveByHash: (keyHash: string, now?: Date) => Promise<S2sClient | undefined>
  findActiveBySchoolAndClientId: (schoolId: string, clientId: string, now?: Date) => Promise<S2sClient | undefined>
}
