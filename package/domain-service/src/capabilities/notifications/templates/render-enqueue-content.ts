import type { NotificationEnqueueInput } from '@edaya/core'
import type { NotificationTemplateKey } from './keys'
import type { NotificationTemplateService } from './notification-template-service'
import { ACCOUNT_INVITATION_TEMPLATE_KEY, isEventNotificationTemplateKey, readEventNotificationTemplate } from '@edaya/core'

export interface RenderNotificationEnqueueContentInput {
  schoolId: string
  templateKey: NotificationTemplateKey
  variables: Record<string, string>
}

export type RenderedNotificationEnqueueContent = Pick<
  NotificationEnqueueInput,
  'title' | 'body' | 'emailSubject' | 'emailBody' | 'smsBody' | 'enableEmail' | 'enablePush' | 'enableSms'
>

/** Renders in-app, email, and SMS slices for a notification enqueue payload. */
export async function renderNotificationEnqueueContent(
  templateService: NotificationTemplateService,
  input: RenderNotificationEnqueueContentInput,
): Promise<RenderedNotificationEnqueueContent> {
  const catalog = await templateService.resolveTemplateDocument(input.schoolId)
  if (!isEventNotificationTemplateKey(input.templateKey)) {
    throw new Error(`Cannot enqueue school notification for ${input.templateKey}`)
  }

  const [inApp, email, sms] = await Promise.all([
    templateService.render({ ...input, channel: 'in_app' }),
    templateService.render({ ...input, channel: 'email' }),
    templateService.render({ ...input, channel: 'sms' }),
  ])

  const entry = readEventNotificationTemplate(catalog, input.templateKey)

  const title = inApp.title ?? inApp.subject ?? email.subject ?? ''

  return {
    title,
    body: inApp.body,
    emailSubject: email.subject ?? title,
    emailBody: email.body,
    smsBody: sms.body,
    enableEmail: entry.enable_email,
    enablePush: entry.enable_push,
    enableSms: entry.enable_sms,
  }
}

export interface RenderedInvitationContent {
  emailSubject: string
  emailBody: string
  smsBody: string
}

/** Renders invitation email and SMS copy. */
export async function renderInvitationContent(
  templateService: NotificationTemplateService,
  input: Omit<RenderNotificationEnqueueContentInput, 'templateKey'> & { templateKey?: typeof ACCOUNT_INVITATION_TEMPLATE_KEY },
): Promise<RenderedInvitationContent> {
  const [email, sms] = await Promise.all([
    templateService.render({
      schoolId: input.schoolId,
      templateKey: ACCOUNT_INVITATION_TEMPLATE_KEY,
      channel: 'email',
      variables: input.variables,
    }),
    templateService.render({
      schoolId: input.schoolId,
      templateKey: ACCOUNT_INVITATION_TEMPLATE_KEY,
      channel: 'sms',
      variables: input.variables,
    }),
  ])
  return {
    emailSubject: email.subject ?? 'Account invitation',
    emailBody: email.body,
    smsBody: sms.body,
  }
}

/** @deprecated Use renderInvitationContent */
export async function renderInvitationEmailContent(
  templateService: NotificationTemplateService,
  input: Omit<RenderNotificationEnqueueContentInput, 'templateKey'> & {
    templateKey?: typeof ACCOUNT_INVITATION_TEMPLATE_KEY
  },
): Promise<{ emailSubject: string, emailBody: string }> {
  const content = await renderInvitationContent(templateService, input)
  return { emailSubject: content.emailSubject, emailBody: content.emailBody }
}
