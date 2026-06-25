import type { NotificationChannelTemplate, SchoolNotificationTemplateDocument } from '../document-schema'
import { schoolNotificationTemplateDocumentSchema } from '../document-schema'

const ACCOUNT_INVITATION_SUBJECT = 'You\'re invited to join {{schoolName}} on Edaya'
const ACCOUNT_INVITATION_BODY = [
  '<p>Hello {{inviteeName}},</p>',
  '<p>You have been invited to connect your account to {{schoolName}} on Edaya.</p>',
  '<p><a href="{{inviteUrl}}">Accept invitation</a></p>',
  '<p>This link expires on {{expiresAt}}.</p>',
].join('')

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
  const document: SchoolNotificationTemplateDocument = {
    'announcement.published': dualChannelFromPlain(
      '{{announcementTitle}}',
      '{{announcementBody}}',
    ),
    'report_card.published': dualChannelFromPlain(
      'Report card published',
      'The report card for {{studentName}} is now available.',
    ),
    'attendance.recorded': dualChannelFromPlain(
      'Attendance update: {{status}}',
      'Attendance was recorded as {{status}} for session {{sessionTitle}}.',
    ),
    'assessment.result_recorded': dualChannelFromPlain(
      'Assessment result recorded',
      'A result was recorded for {{assessmentTitle}}.',
    ),
    'incident.recorded': dualChannelFromPlain(
      'Incident: {{incidentTitle}}',
      '{{incidentDescription}}',
    ),
    'assessment.due_soon': dualChannelFromPlain(
      'Assessment due soon: {{assessmentTitle}}',
      '{{assessmentTitle}} is due on {{dueDate}}.',
    ),
    'homework.due_soon': dualChannelFromPlain(
      'Homework due soon: {{homeworkTitle}}',
      '{{homeworkTitle}} is due on {{dueDate}}.',
    ),
    'activity.reminder': dualChannelFromPlain(
      'Activity starting soon: {{activityName}}',
      '{{activityName}} starts on {{startDate}}.',
    ),
    'calendar.event_reminder': dualChannelFromPlain(
      'Upcoming event: {{eventTitle}}',
      '{{eventTitle}} starts on {{startDate}}.',
    ),
    'account_invitation': {
      email: {
        subject: ACCOUNT_INVITATION_SUBJECT,
        body: ACCOUNT_INVITATION_BODY,
      },
    },
  }

  return schoolNotificationTemplateDocumentSchema.parse(document)
}
