import type { SchoolRepositories } from '../../../ports'
import type { NotificationChannelTemplate, SchoolNotificationTemplateDocument } from './document-schema'
import type { NotificationChannel, NotificationTemplateKey } from './keys'
import { BusinessRuleViolationError } from '../../../domain/shared/business-rule-error'
import { buildDefaultNotificationTemplateDocument } from './defaults/manifest'
import { mergeSchoolNotificationTemplateDocument } from './merge-school-notification-templates'
import { renderTemplateString } from './render'

export interface RenderNotificationTemplateInput {
  schoolId: string
  templateKey: NotificationTemplateKey
  channel: NotificationChannel
  variables: Record<string, string>
}

export class NotificationTemplateService {
  private cachedDefaultDocument?: SchoolNotificationTemplateDocument

  constructor(
    private readonly repositories: Partial<Pick<SchoolRepositories, 'schoolNotificationTemplates'>>,
  ) {}

  async render(input: RenderNotificationTemplateInput): Promise<{ subject?: string, body: string }> {
    const templates = await this.resolveTemplateDocument(input.schoolId)
    const entry = templates[input.templateKey]
    const slice: NotificationChannelTemplate | undefined = input.channel === 'email'
      ? entry.email
      : ('in_app' in entry ? entry.in_app : undefined)
    if (!slice) {
      throw new BusinessRuleViolationError(
        'NOTIFICATION_TEMPLATE_CHANNEL_NOT_FOUND',
        `No ${input.channel} template for ${input.templateKey}`,
      )
    }

    return {
      subject: slice.subject
        ? renderTemplateString(slice.subject, input.variables)
        : undefined,
      body: renderTemplateString(slice.body, input.variables),
    }
  }

  private async resolveTemplateDocument(schoolId: string): Promise<SchoolNotificationTemplateDocument> {
    const defaults = await this.getDefaultDocument()
    const repository = this.repositories.schoolNotificationTemplates
    const row = repository
      ? await repository.findById(schoolId)
      : undefined
    if (!row) {
      return defaults
    }

    return mergeSchoolNotificationTemplateDocument(defaults, row.templates)
  }

  private async getDefaultDocument(): Promise<SchoolNotificationTemplateDocument> {
    if (!this.cachedDefaultDocument) {
      this.cachedDefaultDocument = await buildDefaultNotificationTemplateDocument()
    }
    return this.cachedDefaultDocument
  }
}
