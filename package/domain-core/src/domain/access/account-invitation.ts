import type { EntityConfigFactory } from '../../application/entities/entity-config'
import { z } from 'zod'
import { config, directSchoolTenant, noopReadAccess, permissionAction, read, write } from '../../application/entities/entity-config'
import { denyResourceAccess, Permission } from '../../capabilities/authorization'
import { parseDomain, zodDate } from '../shared/utils'

export enum AccountInvitationKind {
  Staff = 'staff',
  Guardian = 'guardian',
  Student = 'student',
}

export enum AccountInvitationContactChannel {
  Email = 'email',
  Phone = 'phone',
}

export enum AccountInvitationStatus {
  Pending = 'pending',
  Accepted = 'accepted',
  Revoked = 'revoked',
  Expired = 'expired',
}

export const accountInvitationSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  kind: z.nativeEnum(AccountInvitationKind),
  targetId: z.string().trim().min(1, 'targetId must not be blank'),
  contactChannel: z.nativeEnum(AccountInvitationContactChannel),
  contactValue: z.string().trim().min(1, 'contactValue must not be blank'),
  tokenHash: z.string().trim().min(1, 'tokenHash must not be blank'),
  status: z.nativeEnum(AccountInvitationStatus).default(AccountInvitationStatus.Pending),
  expiresAt: zodDate(),
  acceptedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  acceptedSubjectId: z.string().trim().min(1, 'acceptedSubjectId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdByStaffId: z.string().trim().min(1, 'createdByStaffId must not be blank'),
  createdAt: zodDate().default(() => new Date()),
  lastSentAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
})

export type AccountInvitationData = z.infer<typeof accountInvitationSchema>
export type AccountInvitationInput = z.input<typeof accountInvitationSchema>

/** Scoped invitation to link a school actor to an auth account. */
export class AccountInvitation {
  readonly data: AccountInvitationData

  constructor(args: AccountInvitationInput) {
    this.data = parseDomain(accountInvitationSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get kind() { return this.data.kind }
  get targetId() { return this.data.targetId }
  get contactChannel() { return this.data.contactChannel }
  get contactValue() { return this.data.contactValue }
  get tokenHash() { return this.data.tokenHash }
  get status() { return this.data.status }
  get expiresAt() { return this.data.expiresAt }
  get acceptedAt() { return this.data.acceptedAt }
  get acceptedSubjectId() { return this.data.acceptedSubjectId }
  get createdByStaffId() { return this.data.createdByStaffId }
  get createdAt() { return this.data.createdAt }
  get lastSentAt() { return this.data.lastSentAt }

  isPending(now: Date = new Date()): boolean {
    return this.status === AccountInvitationStatus.Pending && this.expiresAt > now
  }

  copyWith(changes: Partial<AccountInvitationInput>): AccountInvitation {
    return new AccountInvitation({ ...this.data, ...changes })
  }
}

export type PublicAccountInvitationData = Omit<AccountInvitationData, 'tokenHash'>

export function toPublicAccountInvitationData(data: AccountInvitationData): PublicAccountInvitationData {
  const { tokenHash: _tokenHash, ...publicData } = data
  return publicData
}

export function toPublicAccountInvitation(invitation: AccountInvitation): PublicAccountInvitationData {
  return toPublicAccountInvitationData(invitation.data)
}

async function denyInvitationEntityWrite(): Promise<void> {
  denyResourceAccess()
}

/** Read-only entity — mutations go through invitation commands. */
export const accountInvitationConfig: EntityConfigFactory<AccountInvitation> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.accountInvitations,
    tenant: directSchoolTenant(),
    read: read(permissionAction(Permission.ACCESS_CONTROL_ASSIGN), noopReadAccess),
    write: write(
      permissionAction(Permission.ACCESS_CONTROL_ASSIGN),
      denyInvitationEntityWrite,
      denyInvitationEntityWrite,
    ),
    atomicExecution,
  })
