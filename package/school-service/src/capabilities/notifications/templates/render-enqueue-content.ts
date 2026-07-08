import type { NotificationEnqueueInput } from '@edaya/core'
import type { NotificationTemplateKey } from './keys'
import type { NotificationTemplateService } from './notification-template-service'

export interface RenderNotificationEnqueueContentInput {
  schoolId: string
  templateKey: NotificationTemplateKey
  variables: Record<string, string>
}

export type RenderedNotificationEnqueueContent = Pick<
  NotificationEnqueueInput,
  'title' | 'body' | 'emailSubject' | 'emailBody'
>

/** Renders in-app and email slices for a notification enqueue payload. */
export async function renderNotificationEnqueueContent(
  templateService: NotificationTemplateService,
  input: RenderNotificationEnqueueContentInput,
): Promise<RenderedNotificationEnqueueContent> {
  const [inApp, email] = await Promise.all([
    templateService.render({ ...input, channel: 'in_app' }),
    templateService.render({ ...input, channel: 'email' }),
  ])

  const title = inApp.subject ?? email.subject ?? ''
  const emailSubject = email.subject ?? inApp.subject ?? title

  return {
    title,
    body: inApp.body,
    emailSubject,
    emailBody: email.body,
  }
}

export interface RenderedInvitationEmailContent {
  emailSubject: string
  emailBody: string
}

/** Renders the account invitation email slice (email channel only). */
export async function renderInvitationEmailContent(
  templateService: NotificationTemplateService,
  input: RenderNotificationEnqueueContentInput,
): Promise<RenderedInvitationEmailContent> {
  const email = await templateService.render({ ...input, channel: 'email' })
  return {
    emailSubject: email.subject ?? 'Account invitation',
    emailBody: email.body,
  }
}
