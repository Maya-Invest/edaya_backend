import type { EventNotificationTemplateEntry, InvitationNotificationTemplateEntry, SchoolNotificationTemplateCatalog } from './notification-template-document-schema'
import type { EventNotificationTemplateKey, NotificationTemplateKey } from './notification-template-keys'
import { z } from 'zod'
import { parseDomain, zodDate } from '../shared/utils'
import {
  isEventNotificationTemplateKey,
  schoolNotificationTemplateCatalogSchema,
} from './notification-template-document-schema'
import {
  ACCOUNT_INVITATION_TEMPLATE_KEY,
  NOTIFICATION_TEMPLATE_FIELDS,
} from './notification-template-keys'

export const schoolNotificationTemplatesSchema = schoolNotificationTemplateCatalogSchema.extend({
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  createdAt: zodDate().default(() => new Date()),
  updatedAt: zodDate().default(() => new Date()),
})

export type SchoolNotificationTemplatesData = z.infer<typeof schoolNotificationTemplatesSchema>
export type SchoolNotificationTemplatesInput = z.input<typeof schoolNotificationTemplatesSchema>

/** One row per school — one JSONB column per template key plus invitation SMS gate. */
export class SchoolNotificationTemplates {
  readonly data: SchoolNotificationTemplatesData

  constructor(args: SchoolNotificationTemplatesInput) {
    this.data = parseDomain(schoolNotificationTemplatesSchema, args)
  }

  get id() { return this.data.schoolId }
  get schoolId() { return this.data.schoolId }
  get invitationSmsEnabled() { return this.data.invitationSmsEnabled }
  get announcementPublished() { return this.data.announcementPublished }
  get reportCardPublished() { return this.data.reportCardPublished }
  get attendanceRecorded() { return this.data.attendanceRecorded }
  get assessmentResultRecorded() { return this.data.assessmentResultRecorded }
  get incidentRecorded() { return this.data.incidentRecorded }
  get assessmentDueSoon() { return this.data.assessmentDueSoon }
  get activityReminder() { return this.data.activityReminder }
  get calendarEventReminder() { return this.data.calendarEventReminder }
  get studentPhotoApproved() { return this.data.studentPhotoApproved }
  get studentPhotoRejected() { return this.data.studentPhotoRejected }
  get accountInvitation() { return this.data.accountInvitation }
  get createdAt() { return this.data.createdAt }
  get updatedAt() { return this.data.updatedAt }

  get catalog(): SchoolNotificationTemplateCatalog {
    const {
      schoolId: _schoolId,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...catalog
    } = this.data
    return catalog
  }

  eventTemplate(key: EventNotificationTemplateKey): EventNotificationTemplateEntry {
    return this.data[NOTIFICATION_TEMPLATE_FIELDS[key]] as EventNotificationTemplateEntry
  }

  invitationTemplate(): InvitationNotificationTemplateEntry {
    return this.data[NOTIFICATION_TEMPLATE_FIELDS[ACCOUNT_INVITATION_TEMPLATE_KEY]]
  }

  templateEntry(key: NotificationTemplateKey): EventNotificationTemplateEntry | InvitationNotificationTemplateEntry {
    if (isEventNotificationTemplateKey(key)) {
      return this.eventTemplate(key)
    }
    return this.invitationTemplate()
  }

  copyWith(changes: Partial<SchoolNotificationTemplatesInput>): SchoolNotificationTemplates {
    return new SchoolNotificationTemplates({ ...this.data, ...changes })
  }
}
