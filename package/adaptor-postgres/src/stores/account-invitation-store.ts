import type {
  AccountInvitationKind,
  FindPendingInvitationsByContactInput,
} from '@edaya/core'
import { AccountInvitation, AccountInvitationStatus } from '@edaya/core'
import { and, eq, gt } from 'drizzle-orm'
import * as schema from '../postgres-schema'
import { asStoreDatabase, PostgresStore } from '../postgres-store'

type AccountInvitationRow = typeof schema.accountInvitations.$inferSelect
type AccountInvitationInsertRow = typeof schema.accountInvitations.$inferInsert

export interface SaveAccountInvitationOptions {
  tokenHash?: string
}

function resolveTokenHash(
  entity: AccountInvitation,
  explicitTokenHash?: string,
): string {
  const tokenHash = explicitTokenHash ?? entity.tokenHash ?? entity.data.tokenHash
  if (!tokenHash) {
    throw new Error('Cannot persist AccountInvitation without tokenHash')
  }
  return tokenHash
}

function toInsertRow(
  entity: AccountInvitation,
  explicitTokenHash?: string,
): AccountInvitationInsertRow {
  return {
    id: entity.id,
    schoolId: entity.schoolId,
    kind: entity.kind,
    targetId: entity.targetId,
    contactChannel: entity.contactChannel,
    contactValue: entity.contactValue,
    tokenHash: resolveTokenHash(entity, explicitTokenHash),
    status: entity.status,
    expiresAt: entity.expiresAt,
    acceptedAt: entity.acceptedAt ?? null,
    acceptedSubjectId: entity.acceptedSubjectId ?? null,
    createdByStaffId: entity.createdByStaffId,
    createdAt: entity.createdAt,
    lastSentAt: entity.lastSentAt ?? null,
  }
}

function toMutableUpdateSet(entity: AccountInvitation): Omit<AccountInvitationInsertRow, 'id' | 'tokenHash'> {
  return {
    schoolId: entity.schoolId,
    kind: entity.kind,
    targetId: entity.targetId,
    contactChannel: entity.contactChannel,
    contactValue: entity.contactValue,
    status: entity.status,
    expiresAt: entity.expiresAt,
    acceptedAt: entity.acceptedAt ?? null,
    acceptedSubjectId: entity.acceptedSubjectId ?? null,
    createdByStaffId: entity.createdByStaffId,
    createdAt: entity.createdAt,
    lastSentAt: entity.lastSentAt ?? null,
  }
}

export class PostgresAccountInvitationStore extends PostgresStore<AccountInvitation, AccountInvitationRow> {
  private readonly mapRow: (row: AccountInvitationRow) => AccountInvitation

  constructor(db: unknown) {
    const mapRow = (row: AccountInvitationRow) => {
      if (!row.tokenHash) {
        throw new Error(`Account invitation ${row.id} is missing token_hash in storage`)
      }

      return new AccountInvitation({
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
    }

    super(
      asStoreDatabase(db),
      schema.accountInvitations,
      entity => ({ ...toInsertRow(entity), acceptedAt: entity.acceptedAt ?? null, acceptedSubjectId: entity.acceptedSubjectId ?? null, lastSentAt: entity.lastSentAt ?? null }),
      mapRow,
    )

    this.mapRow = mapRow
  }

  override async save(
    entity: AccountInvitation,
    options: SaveAccountInvitationOptions = {},
  ): Promise<void> {
    if (this.schoolId) {
      const existing = await this.findById(entity.id)
      await this.saveScopedRow(toInsertRow(entity, options.tokenHash ?? existing?.tokenHash), ['tokenHash'])
      return
    }
    const existing = await this.getClient()
      .select({ id: schema.accountInvitations.id })
      .from(schema.accountInvitations)
      .where(eq(schema.accountInvitations.id, entity.id))
      .limit(1)

    if (existing.length > 0) {
      await this.getClient()
        .update(schema.accountInvitations)
        .set(toMutableUpdateSet(entity))
        .where(eq(schema.accountInvitations.id, entity.id))
      return
    }

    const row = toInsertRow(entity, options.tokenHash)
    await this.getClient()
      .insert(schema.accountInvitations)
      .values(row)
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

  async findPendingByContact(
    input: FindPendingInvitationsByContactInput,
  ): Promise<AccountInvitation[]> {
    const rows = await this.getClient()
      .select()
      .from(schema.accountInvitations)
      .where(and(
        eq(schema.accountInvitations.contactChannel, input.contactChannel),
        eq(schema.accountInvitations.contactValue, input.contactValue),
        eq(schema.accountInvitations.kind, input.kind),
        eq(schema.accountInvitations.status, AccountInvitationStatus.Pending),
        gt(schema.accountInvitations.expiresAt, new Date()),
      ))

    return rows.map((row: AccountInvitationRow) => this.mapRow(row))
  }

  async compareAndSetStatus(
    id: string,
    expectedStatus: AccountInvitationStatus,
    entity: AccountInvitation,
    options: SaveAccountInvitationOptions = {},
  ): Promise<boolean> {
    const tokenHash = options.tokenHash ?? entity.tokenHash ?? entity.data.tokenHash
    const rows = await this.getClient()
      .update(schema.accountInvitations)
      .set({
        ...toMutableUpdateSet(entity),
        ...(tokenHash ? { tokenHash } : {}),
      })
      .where(and(
        eq(schema.accountInvitations.id, id),
        eq(schema.accountInvitations.status, expectedStatus),
        this.schoolId ? eq(schema.accountInvitations.schoolId, this.schoolId) : undefined,
      ))
      .returning({ id: schema.accountInvitations.id })

    return rows.length === 1
  }
}
