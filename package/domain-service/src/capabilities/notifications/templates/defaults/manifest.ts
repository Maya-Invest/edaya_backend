import type { NotificationChannelTemplate, SchoolNotificationTemplateDocument } from '../document-schema'
import { schoolNotificationTemplateDocumentSchema } from '../document-schema'
import { loadAccountInvitationDefaultFiles } from './load-default-files'

function dualChannelFromPlain(subject: string, body: string): {
  email: NotificationChannelTemplate
  in_app: NotificationChannelTemplate
} {
  return {
    email: { subject, body: `<p>${body}</p>` },
    in_app: { subject, body },
  }
}

/** Platform default notification template document — copied once per school at registration. */
export async function buildDefaultNotificationTemplateDocument(): Promise<SchoolNotificationTemplateDocument> {
  const accountInvitation = await loadAccountInvitationDefaultFiles()
  const document: SchoolNotificationTemplateDocument = {
    'announcement.published': {
      email: {
        subject: '{{schoolName}}: {{announcementTitle}}',
        body: '<p>{{announcementBody}}</p>',
      },
      in_app: {
        subject: '{{schoolName}}: {{announcementTitle}}',
        body: '{{announcementBodyShort}}',
      },
    },
    'report_card.published': dualChannelFromPlain(
      'Report card — {{studentName}}',
      '{{periodName}} results for {{classGroupName}} are available.',
    ),
    'attendance.recorded': dualChannelFromPlain(
      '{{studentName}} — {{statusLabel}}',
      '{{sessionTitle}} on {{sessionDate}} at {{sessionTime}} ({{classGroupName}})',
    ),
    'assessment.result_recorded': dualChannelFromPlain(
      '{{studentName}} — {{assessmentTitle}}',
      'Score {{scoreDisplay}} · {{subjectName}}',
    ),
    'incident.recorded': dualChannelFromPlain(
      '{{studentName}} — {{incidentTitle}}',
      '{{incidentKindLabel}} on {{incidentDate}}. {{incidentDescription}}',
    ),
    'assessment.due_soon': dualChannelFromPlain(
      '{{assessmentTitle}} due {{dueDateLabel}}',
      '{{subjectName}} · {{classGroupName}} — due {{dueDateLabel}}',
    ),
    'activity.reminder': dualChannelFromPlain(
      'Reminder: {{activityName}}',
      '{{startDate}} · {{activitySchedule}} ({{coachName}})',
    ),
    'calendar.event_reminder': dualChannelFromPlain(
      'Reminder: {{eventTitle}}',
      '{{dateRange}} · {{scopeLabel}}',
    ),
    'account_invitation': {
      email: {
        subject: accountInvitation.subject,
        body: accountInvitation.body,
      },
    },
  }

  return schoolNotificationTemplateDocumentSchema.parse(document)
}
