import { ServiceApiKey } from '@edaya/core'
import { and, eq, isNull } from 'drizzle-orm'
import * as schema from '../postgres-schema'
import { asStoreDatabase, PostgresStore } from '../postgres-store'

export class PostgresServiceApiKeyStore extends PostgresStore<ServiceApiKey> {
  private readonly mapRow: (row: any) => ServiceApiKey

  constructor(db: any) {
    const mapRow = (row: any) => new ServiceApiKey({
      id: row.id,
      staffMemberId: row.staffMemberId,
      schoolId: row.schoolId,
      keyPrefix: row.keyPrefix,
      keyHash: row.keyHash,
      createdBySubjectId: row.createdBySubjectId,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      lastUsedAt: row.lastUsedAt,
    })

    super(
      asStoreDatabase(db),
      schema.serviceApiKeys,
      (entity: ServiceApiKey) => ({
        id: entity.id,
        staffMemberId: entity.staffMemberId,
        schoolId: entity.schoolId,
        keyPrefix: entity.keyPrefix,
        keyHash: entity.keyHash,
        createdBySubjectId: entity.createdBySubjectId,
        createdAt: entity.createdAt,
        expiresAt: entity.expiresAt ?? null,
        revokedAt: entity.revokedAt ?? null,
        lastUsedAt: entity.lastUsedAt ?? null,
      }),
      mapRow,
    )

    this.mapRow = mapRow
  }

  async findActiveByHash(keyHash: string, now: Date = new Date()): Promise<ServiceApiKey | undefined> {
    const rows = await this.getClient()
      .select()
      .from(schema.serviceApiKeys)
      .where(and(
        eq(schema.serviceApiKeys.keyHash, keyHash),
        isNull(schema.serviceApiKeys.revokedAt),
      ))

    for (const row of rows) {
      const key = this.mapRow(row)
      if (key.isActive(now)) {
        return key
      }
    }

    return undefined
  }

  async countActiveElevatedServiceAccounts(schoolId: string): Promise<number> {
    const staffRows = await this.getClient()
      .select({ id: schema.staffMembers.id })
      .from(schema.staffMembers)
      .where(and(
        eq(schema.staffMembers.schoolId, schoolId),
        eq(schema.staffMembers.accountKind, 'service'),
        eq(schema.staffMembers.serviceElevated, true),
        eq(schema.staffMembers.isActive, true),
      ))

    return staffRows.length
  }
}
