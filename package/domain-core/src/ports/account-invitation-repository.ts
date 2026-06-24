import type { AccountInvitation, AccountInvitationKind } from '../domains/access/account-invitation'
import type { BaseRepositoryInterface } from './base-repository'

export interface AccountInvitationRepository extends BaseRepositoryInterface<AccountInvitation> {
  findByTokenHash: (tokenHash: string) => Promise<AccountInvitation | undefined>
  findPendingByTarget: (
    schoolId: string,
    kind: AccountInvitationKind,
    targetId: string,
  ) => Promise<AccountInvitation | undefined>
}
