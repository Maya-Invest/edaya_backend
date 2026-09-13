import type { PlatformAction, PlatformUserRepository } from '@edaya/core'
import type { ActorMetadata } from '../model/actor'
import { BusinessRuleViolationError, Permission as P } from '@edaya/core'
import { denied } from './facts'

export class PlatformPolicies {
  constructor(readonly actor: ActorMetadata, readonly users: PlatformUserRepository) {}

  async currentUser() {
    if (this.actor.kind !== 'platform')
      return denied('Platform profile required')
    const user = await this.users.findById(this.actor.actorId)
    if (!user?.isActive || user.subjectId !== this.actor.subjectId)
      return denied()
    return user
  }

  private async assertAction(action: PlatformAction) {
    const user = await this.currentUser()
    if (!user.permissions.includes(action))
      denied()
    return user
  }

  readUsers = () => this.assertAction(P.PLATFORM_USER_READ)
  readClients = () => this.assertAction(P.S2S_CLIENT_READ)
  createClient = () => this.assertAction(P.S2S_CLIENT_CREATE)
  revokeClient = () => this.assertAction(P.S2S_CLIENT_REVOKE)
  rotateClientKey = () => this.assertAction(P.S2S_CLIENT_ROTATE_KEY)

  async createUser(requested?: readonly PlatformAction[]) {
    const user = await this.assertAction(P.PLATFORM_USER_CREATE)
    const permissions = [...new Set(requested ?? user.permissions)]
    if (!permissions.length || permissions.some(permission => !user.permissions.includes(permission)))
      denied('Platform delegation exceeds the operator’s permissions')
    return permissions
  }

  async deactivateUser(id: string) {
    const user = await this.assertAction(P.PLATFORM_USER_DEACTIVATE)
    if (user.id === id)
      throw new BusinessRuleViolationError('PLATFORM_USER_SELF_DEACTIVATE', 'A platform user cannot deactivate themselves')
  }
}
