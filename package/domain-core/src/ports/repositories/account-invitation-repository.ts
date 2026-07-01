import type { AccountInvitation, AccountInvitationKind } from '../domains/access/account-invitation'
import type { BaseRepositoryInterface } from './base-repository'

export interface SaveAccountInvitationOptions {
  tokenHash?: string
}

export interface AccountInvitationRepository extends BaseRepositoryInterface<AccountInvitation> {
  save: (entity: AccountInvitation, options?: SaveAccountInvitationOptions) => Promise<void>
  findByTokenHash: (tokenHash: string) => Promise<AccountInvitation | undefined>
  findPendingByTarget: (
    schoolId: string,
    kind: AccountInvitationKind,
    targetId: string,
  ) => Promise<AccountInvitation | undefined>
}
