import { z } from 'zod'

import { parseDomain, zodDate } from '../shared/utils'
import { shortNameSchema } from '../shared/visible-identification'

export const subjectMatterSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  subjectId: z.string().trim().min(1, 'subjectId must not be blank'),
  name: z.string().trim().min(1, 'name must not be blank'),
  shortName: shortNameSchema.optional(),
  description: z.string().trim().min(1, 'description must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  sequenceOrder: z.number().positive('sequenceOrder must be positive'),
  progressWeight: z.number().finite().positive().optional(),
  estimatedHours: z.number().positive('estimatedHours must be positive').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

export type SubjectMatterData = z.infer<typeof subjectMatterSchema>
export type SubjectMatterInput = z.input<typeof subjectMatterSchema>

export const subjectMatterCreateSchema = subjectMatterSchema.omit({ createdAt: true })
export const subjectMatterUpdateSchema = subjectMatterSchema.partial().required({ id: true })

export class SubjectMatter {
  readonly data: SubjectMatterData

  copyWith(changes: Partial<SubjectMatterInput>): SubjectMatter { return new SubjectMatter({ ...this.data, ...changes }) }

  constructor(args: SubjectMatterInput) {
    this.data = parseDomain(subjectMatterSchema, { ...args, progressWeight: args.progressWeight ?? 1 })
  }

  get id() { return this.data.id }
  get subjectId() { return this.data.subjectId }
  get name() { return this.data.name }
  get shortName() { return this.data.shortName ?? this.name }
  get description() { return this.data.description }
  get sequenceOrder() { return this.data.sequenceOrder }
  get progressWeight() { return this.data.progressWeight ?? 1 }
  get estimatedHours() { return this.data.estimatedHours }
  get createdAt() { return this.data.createdAt }
}
