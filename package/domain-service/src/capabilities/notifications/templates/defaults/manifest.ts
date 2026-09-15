import type { EventNotificationTemplateEntry, SchoolNotificationTemplateCatalog } from '../document-schema'
import { schoolNotificationTemplateCatalogSchema } from '../document-schema'
import { loadAccountInvitationDefaultFiles } from './load-default-files'

function eventFromPlain(title: string, body: string): EventNotificationTemplateEntry {
  return {
    enable_email: true,
    enable_push: true,
    enable_sms: false,
    base_message: { title, body },
    rich_message: { subject: title, body: `<p>${body}</p>` },
    simple_message: { body: `${title}: ${body}` },
  }
}

/** Platform default notification catalog — copied once per school at registration. */
export async function buildDefaultNotificationTemplateDocument(): Promise<SchoolNotificationTemplateCatalog> {
  const accountInvitation = await loadAccountInvitationDefaultFiles()
  const document: SchoolNotificationTemplateCatalog = {
    invitationSmsEnabled: false,
    announcementPublished: {
      enable_email: true,
      enable_push: true,
      enable_sms: false,
      base_message: {
        title: '{{schoolName}}: {{announcementTitle}}',
        body: '{{announcementBodyShort}}',
      },
      rich_message: {
        subject: '{{schoolName}}: {{announcementTitle}}',
        body: '<p>{{announcementBody}}</p>',
      },
      simple_message: {
        body: '{{schoolName}}: {{announcementTitle}} — {{announcementBodyShort}}',
      },
    },
    reportCardPublished: eventFromPlain(
      'Report card — {{studentName}}',
      '{{periodName}} results for {{classGroupName}} are available.',
    ),
    attendanceRecorded: eventFromPlain(
      '{{studentName}} — {{statusLabel}}',
      '{{sessionTitle}} on {{sessionDate}} at {{sessionTime}} ({{classGroupName}})',
    ),
    assessmentResultRecorded: eventFromPlain(
      '{{studentName}} — {{assessmentTitle}}',
      'Score {{scoreDisplay}} · {{subjectName}}',
    ),
    incidentRecorded: eventFromPlain(
      '{{studentName}} — {{incidentTitle}}',
      '{{incidentKindLabel}} on {{incidentDate}}. {{incidentDescription}}',
    ),
    assessmentDueSoon: eventFromPlain(
      '{{assessmentTitle}} due {{dueDateLabel}}',
      '{{subjectName}} · {{classGroupName}} — due {{dueDateLabel}}',
    ),
    activityReminder: eventFromPlain(
      'Reminder: {{activityName}}',
      '{{startDate}} · {{activitySchedule}} ({{coachName}})',
    ),
    calendarEventReminder: eventFromPlain(
      'Reminder: {{eventTitle}}',
      '{{dateRange}} · {{scopeLabel}}',
    ),
    studentPhotoApproved: eventFromPlain(
      'Photo approved — {{studentName}}',
      'The portrait for {{studentName}} is now published.',
    ),
    studentPhotoRejected: eventFromPlain(
      'Photo not approved — {{studentName}}',
      '{{rejectionReason}}',
    ),
    accountInvitation: {
      rich_message: {
        subject: accountInvitation.subject,
        body: accountInvitation.body,
      },
      simple_message: {
        body: accountInvitation.smsBody,
      },
    },
  }

  return schoolNotificationTemplateCatalogSchema.parse(document)
}
