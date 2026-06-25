import type { QueryOptions, SchoolNotificationTemplateDocument } from '@edaya/core'
import {
  buildDefaultNotificationTemplateDocument,
  mergeSchoolNotificationTemplateDocument,
  SchoolNotificationTemplates,
} from '@edaya/core'
import { asc, desc, eq, inArray } from 'drizzle-orm'
import { buildWhereClause } from '../lib/filter'
import * as schema from '../postgres-schema'
import { PostgresStore } from '../postgres-store'

type SchoolNotificationTemplatesRow = typeof schema.schoolNotificationTemplates.$inferSelect
const orderableColumns = {
  id: schema.schoolNotificationTemplates.id,
  schoolId: schema.schoolNotificationTemplates.id,
  createdAt: schema.schoolNotificationTemplates.createdAt,
  updatedAt: schema.schoolNotificationTemplates.updatedAt,
}
type SchoolNotificationTemplatesColumnKey = keyof typeof orderableColumns

function schoolNotificationTemplatesColumn(field: string) {
  const column = orderableColumns[field as SchoolNotificationTemplatesColumnKey]
  if (!column) {
    throw new Error(`Unsupported school notification templates sort field: ${field}`)
  }
  return column
}

export class PostgresSchoolNotificationTemplatesStore extends PostgresStore<SchoolNotificationTemplates> {
  constructor(db: unknown) {
    super(
      db,
      schema.schoolNotificationTemplates,
      (entity: SchoolNotificationTemplates) => ({
        id: entity.schoolId,
        templates: entity.templates as SchoolNotificationTemplateDocument,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      }),
      (row: SchoolNotificationTemplatesRow) => new SchoolNotificationTemplates({
        schoolId: row.id,
        templates: row.templates as SchoolNotificationTemplateDocument,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }),
    )
  }

  override async findById(id: string): Promise<SchoolNotificationTemplates | undefined> {
    const rows = await this.getClient()
      .select()
      .from(schema.schoolNotificationTemplates)
      .where(eq(schema.schoolNotificationTemplates.id, id))

    const row = rows[0]
    return row ? this.toDomainRow(row) : undefined
  }

  override async findByIds(ids: readonly string[]): Promise<SchoolNotificationTemplates[]> {
    if (ids.length === 0) {
      return []
    }

    const rows = await this.getClient()
      .select()
      .from(schema.schoolNotificationTemplates)
      .where(inArray(schema.schoolNotificationTemplates.id, [...ids]))

    return Promise.all(rows.map((row: SchoolNotificationTemplatesRow) => this.toDomainRow(row)))
  }

  override async list(options?: QueryOptions<SchoolNotificationTemplates>): Promise<SchoolNotificationTemplates[]> {
    let query = this.getClient().select().from(schema.schoolNotificationTemplates)

    if (options) {
      const whereClause = buildWhereClause(schema.schoolNotificationTemplates, options)
      if (whereClause) {
        query = query.where(whereClause)
      }

      if (options.$orderBy && options.$orderBy.length > 0) {
        const orderByClauses = options.$orderBy.map(({ field, direction }) => {
          const col = schoolNotificationTemplatesColumn(field)
          return direction === 'asc' ? asc(col) : desc(col)
        })
        query = query.orderBy(...orderByClauses)
      }

      if (options.$limit !== undefined) {
        query = query.limit(options.$limit)
      }
      if (options.$offset !== undefined) {
        query = query.offset(options.$offset)
      }
    }

    const rows = await query
    return Promise.all(rows.map((row: SchoolNotificationTemplatesRow) => this.toDomainRow(row)))
  }

  private async toDomainRow(row: SchoolNotificationTemplatesRow): Promise<SchoolNotificationTemplates> {
    const defaults = await buildDefaultNotificationTemplateDocument()
    const templates = mergeSchoolNotificationTemplateDocument(
      defaults,
      row.templates as SchoolNotificationTemplateDocument,
    )

    return new SchoolNotificationTemplates({
      schoolId: row.id,
      templates,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  }
}
