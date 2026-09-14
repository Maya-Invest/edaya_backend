import type { Filter, QueryOptions, SchoolNotificationTemplateCatalog } from '@edaya/core'
import { SchoolNotificationTemplates } from '@edaya/core'
import { buildDefaultNotificationTemplateDocument, mergeNotificationTemplateCatalogs } from '@edaya/service'
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

function packTemplateRow(entity: SchoolNotificationTemplates): SchoolNotificationTemplatesRow {
  return {
    id: entity.schoolId,
    invitationSmsEnabled: entity.invitationSmsEnabled,
    announcementPublished: entity.announcementPublished,
    reportCardPublished: entity.reportCardPublished,
    attendanceRecorded: entity.attendanceRecorded,
    assessmentResultRecorded: entity.assessmentResultRecorded,
    incidentRecorded: entity.incidentRecorded,
    assessmentDueSoon: entity.assessmentDueSoon,
    activityReminder: entity.activityReminder,
    calendarEventReminder: entity.calendarEventReminder,
    accountInvitation: entity.accountInvitation,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  }
}

function storedCatalog(row: SchoolNotificationTemplatesRow): SchoolNotificationTemplateCatalog {
  return {
    invitationSmsEnabled: row.invitationSmsEnabled,
    announcementPublished: row.announcementPublished,
    reportCardPublished: row.reportCardPublished,
    attendanceRecorded: row.attendanceRecorded,
    assessmentResultRecorded: row.assessmentResultRecorded,
    incidentRecorded: row.incidentRecorded,
    assessmentDueSoon: row.assessmentDueSoon,
    activityReminder: row.activityReminder,
    calendarEventReminder: row.calendarEventReminder,
    accountInvitation: row.accountInvitation,
  }
}

export class PostgresSchoolNotificationTemplatesStore extends PostgresStore<SchoolNotificationTemplates> {
  constructor(db: unknown) {
    super(
      db,
      schema.schoolNotificationTemplates,
      (entity: SchoolNotificationTemplates) => packTemplateRow(entity),
      (row: SchoolNotificationTemplatesRow) => new SchoolNotificationTemplates({
        schoolId: row.id,
        ...storedCatalog(row),
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
    return this.toDomainRow(packTemplateRow(entity))
  }

  private async toDomainRow(row: SchoolNotificationTemplatesRow): Promise<SchoolNotificationTemplates> {
    const defaults = await buildDefaultNotificationTemplateDocument()
    const catalog = mergeNotificationTemplateCatalogs(defaults, storedCatalog(row))

    return new SchoolNotificationTemplates({
      schoolId: row.id,
      ...catalog,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  }
}
