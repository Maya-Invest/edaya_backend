import type { Filter, QueryOptions } from '@edaya/core'
import type { SchoolNotificationTemplateDocument } from '@edaya/service'
import { SchoolNotificationTemplates } from '@edaya/core'
import { buildDefaultNotificationTemplateDocument, mergeSchoolNotificationTemplateDocument } from '@edaya/service'
import { asc, desc, eq, inArray, sql } from 'drizzle-orm'
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

export function normalizeSchoolNotificationTemplatesQuery<T>(
  options?: QueryOptions<T> | Filter<T>,
): QueryOptions<T> | Filter<T> | undefined {
  if (!options || typeof options !== 'object') {
    return options
  }

  const schoolId = (options as { schoolId?: unknown }).schoolId
  if (typeof schoolId !== 'string') {
    return options
  }

  const { schoolId: _schoolId, ...rest } = options as QueryOptions<T> & { schoolId: string }
  return { ...rest, id: schoolId } as QueryOptions<T>
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
    const normalizedOptions = normalizeSchoolNotificationTemplatesQuery(options)

    if (normalizedOptions) {
      const whereClause = buildWhereClause(schema.schoolNotificationTemplates, normalizedOptions)
      if (whereClause) {
        query = query.where(whereClause)
      }

      if (normalizedOptions.$orderBy && normalizedOptions.$orderBy.length > 0) {
        const orderByClauses = normalizedOptions.$orderBy.map(({ field, direction }) => {
          const col = schoolNotificationTemplatesColumn(field)
          return direction === 'asc' ? asc(col) : desc(col)
        })
        query = query.orderBy(...orderByClauses)
      }

      if (normalizedOptions.$limit !== undefined) {
        query = query.limit(normalizedOptions.$limit)
      }
      if (normalizedOptions.$offset !== undefined) {
        query = query.offset(normalizedOptions.$offset)
      }
    }

    const rows = await query
    return Promise.all(rows.map((row: SchoolNotificationTemplatesRow) => this.toDomainRow(row)))
  }

  override async count(filter?: Filter<SchoolNotificationTemplates>): Promise<number> {
    let query = this.getClient().select({ count: sql<number>`count(*)` }).from(schema.schoolNotificationTemplates)
    const normalizedFilter = normalizeSchoolNotificationTemplatesQuery(filter)

    if (normalizedFilter) {
      const whereClause = buildWhereClause(schema.schoolNotificationTemplates, normalizedFilter)
      if (whereClause) {
        query = query.where(whereClause)
      }
    }

    const rows = await query
    return Number(rows[0]?.count ?? 0)
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
