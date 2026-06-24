import {
  AccountInvitation,
  AccountInvitationKind,
  AccountInvitationStatus,
} from '@edaya/core'
import { and, eq } from 'drizzle-orm'
import * as schema from '../postgres-schema'
import { PostgresStore } from '../postgres-store'

export class PostgresAccountInvitationStore extends PostgresStore<AccountInvitation> {
  private readonly mapRow: (row: typeof schema.accountInvitations.$inferSelect) => AccountInvitation

  constructor(db: unknown) {
    const mapRow = (row: typeof schema.accountInvitations.$inferSelect) => new AccountInvitation({
      id: row.id,
      schoolId: row.schoolId,
      kind: row.kind as AccountInvitationKind,
      targetId: row.targetId,
      contactChannel: row.contactChannel as AccountInvitation['contactChannel'],
      contactValue: row.contactValue,
      tokenHash: row.tokenHash,
      status: row.status as AccountInvitationStatus,
      expiresAt: row.expiresAt,
      acceptedAt: row.acceptedAt ?? undefined,
      acceptedSubjectId: row.acceptedSubjectId ?? undefined,
      createdByStaffId: row.createdByStaffId,
      createdAt: row.createdAt,
      lastSentAt: row.lastSentAt ?? undefined,
    })

    super(
      db,
      schema.accountInvitations,
      (entity: AccountInvitation) => ({
        id: entity.id,
        schoolId: entity.schoolId,
        kind: entity.kind,
        targetId: entity.targetId,
        contactChannel: entity.contactChannel,
        contactValue: entity.contactValue,
        tokenHash: entity.tokenHash,
        status: entity.status,
        expiresAt: entity.expiresAt,
        acceptedAt: entity.acceptedAt ?? null,
        acceptedSubjectId: entity.acceptedSubjectId ?? null,
        createdByStaffId: entity.createdByStaffId,
        createdAt: entity.createdAt,
        lastSentAt: entity.lastSentAt ?? null,
      }),
      mapRow,
    )

    this.mapRow = mapRow
  }

  async findByTokenHash(tokenHash: string): Promise<AccountInvitation | undefined> {
    const rows = await this.getClient()
      .select()
      .from(schema.accountInvitations)
      .where(eq(schema.accountInvitations.tokenHash, tokenHash))
      .limit(1)

    const row = rows[0]
    return row ? this.mapRow(row) : undefined
  }

  async findPendingByTarget(
    schoolId: string,
    kind: AccountInvitationKind,
    targetId: string,
  ): Promise<AccountInvitation | undefined> {
    const rows = await this.getClient()
      .select()
      .from(schema.accountInvitations)
      .where(and(
        eq(schema.accountInvitations.schoolId, schoolId),
        eq(schema.accountInvitations.kind, kind),
        eq(schema.accountInvitations.targetId, targetId),
        eq(schema.accountInvitations.status, AccountInvitationStatus.Pending),
      ))
      .limit(1)

    const row = rows[0]
    return row ? this.mapRow(row) : undefined
  }
}
