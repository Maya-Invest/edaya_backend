import { PlatformUser } from '@edaya/core'
import { eq } from 'drizzle-orm'
import * as schema from '../postgres-schema'
import { PostgresStore } from '../postgres-store'

export class PostgresPlatformUserStore extends PostgresStore<PlatformUser> {
  private readonly mapRow: (row: any) => PlatformUser

  constructor(db: any) {
    const mapRow = (row: any) => new PlatformUser({
      id: row.id,
      subjectId: row.subjectId,
      email: row.email,
      permissions: row.permissions,
      isActive: row.isActive,
      createdBySubjectId: row.createdBySubjectId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })

    super(
      db,
      schema.platformUsers,
      (entity: PlatformUser) => ({
        id: entity.id,
        subjectId: entity.subjectId,
        email: entity.email,
        permissions: entity.permissions,
        isActive: entity.isActive,
        createdBySubjectId: entity.createdBySubjectId,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      }),
      mapRow,
    )

    this.mapRow = mapRow
  }

  async findBySubjectId(subjectId: string): Promise<PlatformUser | undefined> {
    const rows = await this.getClient()
      .select()
      .from(schema.platformUsers)
      .where(eq(schema.platformUsers.subjectId, subjectId))
    if (rows.length === 0) {
      return undefined
    }
    return this.mapRow(rows[0])
  }

  async findByEmail(email: string): Promise<PlatformUser | undefined> {
    const rows = await this.getClient()
      .select()
      .from(schema.platformUsers)
      .where(eq(schema.platformUsers.email, email.trim().toLowerCase()))
    if (rows.length === 0) {
      return undefined
    }
    return this.mapRow(rows[0])
  }
}
