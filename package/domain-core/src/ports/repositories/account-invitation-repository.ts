import type {
  AccountInvitation,
  AccountInvitationContactChannel,
  AccountInvitationKind,
  AccountInvitationStatus,
} from '../../domain/access/account-invitation'
import type { BaseRepositoryInterface } from './base-repository'

export interface SaveAccountInvitationOptions {
  tokenHash?: string
}

export interface FindPendingInvitationsByContactInput {
  contactChannel: AccountInvitationContactChannel
  contactValue: string
  kind: AccountInvitationKind
}

export interface AccountInvitationRepository extends BaseRepositoryInterface<AccountInvitation> {
  save: (entity: AccountInvitation, options?: SaveAccountInvitationOptions) => Promise<void>
  findByTokenHash: (tokenHash: string) => Promise<AccountInvitation | undefined>
  findPendingByTarget: (
    schoolId: string,
    kind: AccountInvitationKind,
    targetId: string,
  ) => Promise<AccountInvitation | undefined>
  findPendingByContact: (input: FindPendingInvitationsByContactInput) => Promise<AccountInvitation[]>
  compareAndSetStatus: (
    id: string,
    expectedStatus: AccountInvitationStatus,
    entity: AccountInvitation,
    options?: SaveAccountInvitationOptions,
  ) => Promise<boolean>
}
