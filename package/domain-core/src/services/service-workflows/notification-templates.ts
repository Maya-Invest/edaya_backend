import type { SchoolNotificationTemplates } from '../../domains/messaging/school-notification-templates'
import type { NotificationTemplateKey } from '../../notifications/templates/keys'
import type { SchoolNotificationTemplateDocumentPatch } from '../../notifications/templates/merge-school-notification-templates'
import type { BaseSchoolService } from '../base-school-service'
import { Permission } from '../../authorization'
import { SchoolNotificationTemplates as SchoolNotificationTemplatesEntity } from '../../domains/messaging/school-notification-templates'
import { buildDefaultNotificationTemplateDocument } from '../../notifications/templates/defaults/manifest'
import {
  mergeSchoolNotificationTemplateDocument,
} from '../../notifications/templates/merge-school-notification-templates'
import { permissionAction } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { BaseServiceWorkflow } from './base-service-workflow'

export interface UpdateSchoolNotificationTemplatesInput {
  schoolId: string
  templates: SchoolNotificationTemplateDocumentPatch
  expectedUpdatedAt?: Date
}

export interface ResetSchoolNotificationTemplatesInput {
  schoolId: string
  templateKey?: NotificationTemplateKey
}

export class NotificationTemplatesServiceWorkflow extends BaseServiceWorkflow {
  constructor(base: BaseSchoolService) {
    super(base)
  }

  async updateSchoolNotificationTemplates(
    input: UpdateSchoolNotificationTemplatesInput,
  ): Promise<SchoolNotificationTemplates> {
    await permissionAction(Permission.SCHOOL_LIFECYCLE_MANAGE)(this.baseService.actor)
    this.checkActorSchool(input.schoolId)

    const existing = await this.requireTemplateDocument(input.schoolId)
    if (
      input.expectedUpdatedAt
      && existing.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()
    ) {
      throw new BusinessRuleViolationError(
        'NOTIFICATION_TEMPLATE_DOCUMENT_CONFLICT',
        'Notification templates were updated by another change',
      )
    }

    const templates = mergeSchoolNotificationTemplateDocument(existing.templates, input.templates)
    return this.saveTemplateDocument(existing, templates)
  }

  async resetSchoolNotificationTemplates(
    input: ResetSchoolNotificationTemplatesInput,
  ): Promise<SchoolNotificationTemplates> {
    await permissionAction(Permission.SCHOOL_LIFECYCLE_MANAGE)(this.baseService.actor)
    this.checkActorSchool(input.schoolId)

    const existing = await this.requireTemplateDocument(input.schoolId)
    const defaults = await buildDefaultNotificationTemplateDocument()

    const templates = input.templateKey
      ? mergeSchoolNotificationTemplateDocument(existing.templates, {
          [input.templateKey]: defaults[input.templateKey],
        })
      : defaults

    return this.saveTemplateDocument(existing, templates)
  }

  private async requireTemplateDocument(schoolId: string): Promise<SchoolNotificationTemplates> {
    const existing = await this.baseService.repositories.schoolNotificationTemplates.findById(schoolId)
    if (!existing) {
      throw new BusinessRuleViolationError(
        'NOTIFICATION_TEMPLATES_NOT_FOUND',
        `No notification templates for school ${schoolId}`,
      )
    }
    return existing
  }

  private async saveTemplateDocument(
    existing: SchoolNotificationTemplates,
    templates: SchoolNotificationTemplates['templates'],
  ): Promise<SchoolNotificationTemplates> {
    const now = new Date()
    const updated = new SchoolNotificationTemplatesEntity({
      schoolId: existing.schoolId,
      templates,
      createdAt: existing.createdAt,
      updatedAt: now,
    })
    await this.baseService.repositories.schoolNotificationTemplates.save(updated)
    return updated
  }
}
