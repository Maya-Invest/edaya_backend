import type { EntityConfigFactory } from '../../application/entities/entity-config'
import { z } from 'zod'
import { denyResourceAccess, Permission } from '../../capabilities/authorization'
import { schoolNotificationTemplateDocumentSchema } from '../../capabilities/notifications/templates/document-schema'
import { config, directSchoolTenant, noopReadAccess, permissionAction, read, write } from '../../application/entities/entity-config'
import { parseDomain, zodDate } from '../shared/utils'

export const schoolNotificationTemplatesSchema = z.object({
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  templates: schoolNotificationTemplateDocumentSchema,
  createdAt: zodDate().default(() => new Date()),
  updatedAt: zodDate().default(() => new Date()),
})

export type SchoolNotificationTemplatesData = z.infer<typeof schoolNotificationTemplatesSchema>
export type SchoolNotificationTemplatesInput = z.input<typeof schoolNotificationTemplatesSchema>

/** One row per school — full notification template catalog as JSON. */
export class SchoolNotificationTemplates {
  readonly data: SchoolNotificationTemplatesData

  constructor(args: SchoolNotificationTemplatesInput) {
    this.data = parseDomain(schoolNotificationTemplatesSchema, args)
  }

  get id() { return this.data.schoolId }
  get schoolId() { return this.data.schoolId }
  get templates() { return this.data.templates }
  get createdAt() { return this.data.createdAt }
  get updatedAt() { return this.data.updatedAt }

  copyWith(changes: Partial<SchoolNotificationTemplatesInput>): SchoolNotificationTemplates {
    return new SchoolNotificationTemplates({ ...this.data, ...changes })
  }
}

async function denyTemplateEntityWrite(): Promise<void> {
  denyResourceAccess()
}

/** Read-only entity — mutations go through template commands (Phase 3). */
export const schoolNotificationTemplatesConfig: EntityConfigFactory<SchoolNotificationTemplates> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.schoolNotificationTemplates,
    tenant: directSchoolTenant(),
    read: read(permissionAction(Permission.SCHOOL_LIFECYCLE_MANAGE), noopReadAccess),
    write: write(
      permissionAction(Permission.SCHOOL_LIFECYCLE_MANAGE),
      denyTemplateEntityWrite,
      denyTemplateEntityWrite,
    ),
    atomicExecution,
  })
