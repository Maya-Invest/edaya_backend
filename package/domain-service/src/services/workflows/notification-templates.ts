import type { SchoolNotificationTemplates } from '@edaya/core'
import type { NotificationTemplateKey } from '../../capabilities/notifications/templates/keys'
import type { SchoolNotificationTemplateDocumentPatch } from '../../capabilities/notifications/templates/merge-school-notification-templates'
import type { BaseSchoolService } from '../base-school-service'
import { SchoolStructureOperations } from '@edaya/authorization'
import { BusinessRuleViolationError, SchoolNotificationTemplates as SchoolNotificationTemplatesEntity } from '@edaya/core'
import { buildDefaultNotificationTemplateDocument } from '../../capabilities/notifications/templates/defaults/manifest'
import {
  mergeSchoolNotificationTemplateDocument,
} from '../../capabilities/notifications/templates/merge-school-notification-templates'
import { operationModule } from '../entities/entity-config'
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
    await operationModule(SchoolStructureOperations.lifecycleManage)(this.baseService.actor)
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
    await operationModule(SchoolStructureOperations.lifecycleManage)(this.baseService.actor)
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
