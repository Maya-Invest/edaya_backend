import type { SchoolNotificationTemplateCatalog } from '@edaya/core'
import type { SchoolRepositories } from '../../../ports/school-repositories'
import type { EventNotificationTemplateEntry, InvitationNotificationTemplateEntry } from './document-schema'
import type { NotificationChannel, NotificationTemplateKey } from './keys'
import {
  ACCOUNT_INVITATION_TEMPLATE_KEY,
  BusinessRuleViolationError,
  isEventNotificationTemplateKey,
  readEventNotificationTemplate,

} from '@edaya/core'
import { buildDefaultNotificationTemplateDocument } from './defaults/manifest'
import { renderTemplateString } from './render'

export interface RenderNotificationTemplateInput {
  schoolId: string
  templateKey: NotificationTemplateKey
  channel: NotificationChannel
  variables: Record<string, string>
}

export class NotificationTemplateService {
  private cachedDefaultDocument?: SchoolNotificationTemplateCatalog

  constructor(
    private readonly repositories: Partial<Pick<SchoolRepositories, 'schoolNotificationTemplates'>>,
  ) {}

  async render(input: RenderNotificationTemplateInput): Promise<{ subject?: string, title?: string, body: string }> {
    const catalog = await this.resolveTemplateDocument(input.schoolId)
    if (input.templateKey === ACCOUNT_INVITATION_TEMPLATE_KEY) {
      const entry = catalog.accountInvitation
      if (input.channel === 'email') {
        return {
          subject: renderTemplateString(entry.rich_message.subject, input.variables),
          body: renderTemplateString(entry.rich_message.body, input.variables),
        }
      }
      if (input.channel === 'sms') {
        return { body: renderTemplateString(entry.simple_message.body, input.variables) }
      }
      throw new BusinessRuleViolationError(
        'NOTIFICATION_TEMPLATE_CHANNEL_NOT_FOUND',
        `No ${input.channel} template for ${input.templateKey}`,
      )
    }

    if (!isEventNotificationTemplateKey(input.templateKey)) {
      throw new BusinessRuleViolationError(
        'NOTIFICATION_TEMPLATE_CHANNEL_NOT_FOUND',
        `No ${input.channel} template for ${input.templateKey}`,
      )
    }

    const entry = readEventNotificationTemplate(catalog, input.templateKey)
    if (input.channel === 'email') {
      return {
        subject: renderTemplateString(entry.rich_message.subject, input.variables),
        body: renderTemplateString(entry.rich_message.body, input.variables),
      }
    }
    if (input.channel === 'in_app') {
      return {
        title: renderTemplateString(entry.base_message.title, input.variables),
        subject: renderTemplateString(entry.base_message.title, input.variables),
        body: renderTemplateString(entry.base_message.body, input.variables),
      }
    }
    return { body: renderTemplateString(entry.simple_message.body, input.variables) }
  }

  async resolveTemplateDocument(schoolId: string): Promise<SchoolNotificationTemplateCatalog> {
    const defaults = await this.getDefaultDocument()
    const repository = this.repositories.schoolNotificationTemplates
    const row = repository
      ? await repository.findById(schoolId)
      : undefined
    if (!row) {
      return defaults
    }

    return row.catalog
  }

  private async getDefaultDocument(): Promise<SchoolNotificationTemplateCatalog> {
    if (!this.cachedDefaultDocument) {
      this.cachedDefaultDocument = await buildDefaultNotificationTemplateDocument()
    }
    return this.cachedDefaultDocument
  }
}

export type { EventNotificationTemplateEntry, InvitationNotificationTemplateEntry }
