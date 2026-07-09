import type { AuthorizationRepositories } from '@edaya/authorization'
import type { EffectiveGrants } from '../model/effective-grants'
import type { AuthorizationRepository } from './authorization-repository'
import { resolveActorGrants } from './resolve-actor-grants'
import { resolveEffectiveGrants } from './resolve-effective-grants'

export class DefaultAuthorizationRepository implements AuthorizationRepository {
  constructor(private readonly repositories: AuthorizationRepositories) {}

  async resolveEffectiveGrants(args: {
    staffMemberId: string
    schoolId: string
    academicYearId?: string
    now?: Date
  }): Promise<EffectiveGrants> {
    return resolveEffectiveGrants({
      ...args,
      repositories: this.repositories as AuthorizationRepositories,
    })
  }

  async resolveActorGrants(args: {
    actorId: string
    actorType: 'staff' | 'guardian' | 'student'
    schoolId: string
    academicYearId?: string
    now?: Date
  }): Promise<EffectiveGrants> {
    return resolveActorGrants({
      ...args,
      repositories: this.repositories as AuthorizationRepositories,
    })
  }
}
