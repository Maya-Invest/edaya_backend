import type { Filter, QueryOptions } from '@edaya/core'
import { SchoolNotificationTemplates } from '@edaya/core'
import * as schema from '../postgres-schema'
import { asStoreDatabase, PostgresStore } from '../postgres-store'

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
    studentPhotoApproved: entity.studentPhotoApproved ?? null,
    studentPhotoRejected: entity.studentPhotoRejected ?? null,
    familyFeedbackOpened: entity.familyFeedbackOpened ?? null,
    familyFeedbackReminder: entity.familyFeedbackReminder ?? null,
    familyFeedbackPublished: entity.familyFeedbackPublished ?? null,
    familyFeedbackPurgeReminder: entity.familyFeedbackPurgeReminder ?? null,
    accountInvitation: entity.accountInvitation,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  }
}

function storedCatalog(row: SchoolNotificationTemplatesRow) {
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
    studentPhotoApproved: row.studentPhotoApproved!,
    studentPhotoRejected: row.studentPhotoRejected!,
    familyFeedbackOpened: row.familyFeedbackOpened!,
    familyFeedbackReminder: row.familyFeedbackReminder!,
    familyFeedbackPublished: row.familyFeedbackPublished!,
    familyFeedbackPurgeReminder: row.familyFeedbackPurgeReminder!,
    accountInvitation: row.accountInvitation,
  }
}

export class PostgresSchoolNotificationTemplatesStore extends PostgresStore<SchoolNotificationTemplates, SchoolNotificationTemplatesRow> {
  constructor(db: unknown) {
    super(
      asStoreDatabase(db),
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

  override async list(options?: QueryOptions<SchoolNotificationTemplates>): Promise<SchoolNotificationTemplates[]> {
    return super.list(normalizeSchoolNotificationTemplatesQuery(options))
  }

  override async count(filter?: Filter<SchoolNotificationTemplates>): Promise<number> {
    return super.count(normalizeSchoolNotificationTemplatesQuery(filter))
  }
}
