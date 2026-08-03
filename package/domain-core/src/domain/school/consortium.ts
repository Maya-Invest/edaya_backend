import { z } from 'zod'

import { parseDomain, zodDate } from '../shared/utils'

export const consortiumSharedRulesSchema = z.object({
  structureTemplateIds: z.array(z.string().trim().min(1)).default([]),
}).default({ structureTemplateIds: [] })

export type ConsortiumSharedRules = z.infer<typeof consortiumSharedRulesSchema>
export type ConsortiumSharedRulesInput = z.input<typeof consortiumSharedRulesSchema>

const consortiumSchemaBase = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  name: z.string().trim().min(1, 'name must not be blank'),
  country: z.string().trim().min(1, 'country must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  ownerSubjectId: z.string().trim().min(1, 'ownerSubjectId must not be blank'),
  sharedRules: consortiumSharedRulesSchema,
  createdAt: zodDate().default(() => new Date()),
})

export const consortiumSchema = consortiumSchemaBase

export type ConsortiumData = z.infer<typeof consortiumSchema>
export type ConsortiumInput = z.input<typeof consortiumSchema>

export const consortiumCreateSchema = consortiumSchemaBase.omit({ createdAt: true })
export const consortiumUpdateSchema = consortiumSchemaBase.partial().required({ id: true })

/**
 * Groupe scolaire: parent organisationnel above one or more schools.
 * The creator (ownerSubjectId) is the consortium super-admin.
 */
export class Consortium {
  readonly data: ConsortiumData

  constructor(args: ConsortiumInput) {
    this.data = parseDomain(consortiumSchema, args)
  }

  get id() { return this.data.id }
  get name() { return this.data.name }
  get country() { return this.data.country }
  get ownerSubjectId() { return this.data.ownerSubjectId }
  get sharedRules() { return this.data.sharedRules }
  get createdAt() { return this.data.createdAt }
}
