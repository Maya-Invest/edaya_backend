import type { Filter, QueryOptions } from '@edaya/core'
import type { SchoolNotificationTemplateDocument } from '@edaya/service'
import { SchoolNotificationTemplates } from '@edaya/core'
import { buildDefaultNotificationTemplateDocument, mergeSchoolNotificationTemplateDocument } from '@edaya/service'
import * as schema from '../postgres-schema'
import { PostgresStore } from '../postgres-store'

type SchoolNotificationTemplatesRow = typeof schema.schoolNotificationTemplates.$inferSelect
type SchoolNotificationTemplatesQuery
  = QueryOptions<SchoolNotificationTemplates>
    | Filter<SchoolNotificationTemplates>

export function normalizeSchoolNotificationTemplatesQuery(
  options?: SchoolNotificationTemplatesQuery,
): QueryOptions<SchoolNotificationTemplates> | undefined {
  if (!options || typeof options !== 'object') {
    return options
  }

  const { schoolId, ...rest } = options as QueryOptions<SchoolNotificationTemplates>
  const normalized = { ...rest }
  if (rest.$and)
    normalized.$and = rest.$and.map(filter => normalizeSchoolNotificationTemplatesQuery(filter)!)
  if (rest.$or)
    normalized.$or = rest.$or.map(filter => normalizeSchoolNotificationTemplatesQuery(filter)!)
  if (rest.$not)
    normalized.$not = normalizeSchoolNotificationTemplatesQuery(rest.$not)!
  if (rest.$orderBy)
    normalized.$orderBy = rest.$orderBy.map(order => ({ ...order, field: order.field === 'schoolId' ? 'id' : order.field }))
  if (schoolId === undefined)
    return normalized
  if (normalized.id === undefined)
    return { ...normalized, id: schoolId }
  return { ...normalized, $and: [...(normalized.$and ?? []), { id: schoolId }] }
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
    const entity = await super.findById(id)
    return entity ? this.withDefaults(entity) : undefined
  }

  override async findByIds(ids: readonly string[]): Promise<SchoolNotificationTemplates[]> {
    return Promise.all((await super.findByIds(ids)).map(entity => this.withDefaults(entity)))
  }

  override async list(options?: QueryOptions<SchoolNotificationTemplates>): Promise<SchoolNotificationTemplates[]> {
    return Promise.all((await super.list(normalizeSchoolNotificationTemplatesQuery(options))).map(entity => this.withDefaults(entity)))
  }

  override async count(filter?: Filter<SchoolNotificationTemplates>): Promise<number> {
    return super.count(normalizeSchoolNotificationTemplatesQuery(filter))
  }

  private withDefaults(entity: SchoolNotificationTemplates): Promise<SchoolNotificationTemplates> {
    return this.toDomainRow({ id: entity.schoolId, templates: entity.templates, createdAt: entity.createdAt, updatedAt: entity.updatedAt })
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
