import { S2sClient } from '@edaya/core'
import { and, eq, isNull } from 'drizzle-orm'
import * as schema from '../postgres-schema'
import { asStoreDatabase, PostgresStore } from '../postgres-store'

export class PostgresS2sClientStore extends PostgresStore<S2sClient> {
  private readonly mapRow: (row: any) => S2sClient

  constructor(db: any) {
    const mapRow = (row: any) => new S2sClient({
      id: row.id,
      schoolId: row.schoolId,
      clientId: row.clientId,
      accessClass: row.accessClass,
      keyPrefix: row.keyPrefix,
      keyHash: row.keyHash,
      createdBySubjectId: row.createdBySubjectId,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt ?? undefined,
      revokedAt: row.revokedAt ?? undefined,
      lastUsedAt: row.lastUsedAt ?? undefined,
    })

    super(
      asStoreDatabase(db),
      schema.s2sClients,
      (entity: S2sClient) => ({
        id: entity.id,
        schoolId: entity.schoolId,
        clientId: entity.clientId,
        accessClass: entity.accessClass,
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

  async findActiveByHash(keyHash: string, now: Date = new Date()): Promise<S2sClient | undefined> {
    const rows = await this.getClient()
      .select()
      .from(schema.s2sClients)
      .where(and(
        eq(schema.s2sClients.keyHash, keyHash),
        isNull(schema.s2sClients.revokedAt),
      ))

    for (const row of rows) {
      const client = this.mapRow(row)
      if (client.isActive(now)) {
        return client
      }
    }

    return undefined
  }

  async findActiveBySchoolAndClientId(
    schoolId: string,
    clientId: string,
    now: Date = new Date(),
  ): Promise<S2sClient | undefined> {
    const rows = await this.getClient()
      .select()
      .from(schema.s2sClients)
      .where(and(
        eq(schema.s2sClients.schoolId, schoolId),
        eq(schema.s2sClients.clientId, clientId),
        isNull(schema.s2sClients.revokedAt),
      ))

    for (const row of rows) {
      const client = this.mapRow(row)
      if (client.isActive(now)) {
        return client
      }
    }

    return undefined
  }
}
