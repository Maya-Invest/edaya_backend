import type { PlatformUser } from '../../domain/platform/platform-user'
import type { BaseRepositoryInterface } from './base-repository'

export interface PlatformUserRepository extends BaseRepositoryInterface<PlatformUser> {
  findBySubjectId: (subjectId: string) => Promise<PlatformUser | undefined>
  findByEmail: (email: string) => Promise<PlatformUser | undefined>
}
