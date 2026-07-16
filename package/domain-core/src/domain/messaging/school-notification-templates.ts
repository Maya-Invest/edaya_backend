import { z } from 'zod'

import { parseDomain, zodDate } from '../shared/utils'

import { schoolNotificationTemplateDocumentSchema } from './notification-template-document-schema'

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
