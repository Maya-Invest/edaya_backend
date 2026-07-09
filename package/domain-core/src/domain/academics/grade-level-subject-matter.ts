import { z } from 'zod'

import { parseDomain, zodDate } from '../shared/utils'

export const gradeLevelSubjectMatterSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  gradeLevelSubjectId: z.string().trim().min(1, 'gradeLevelSubjectId must not be blank'),
  subjectMatterId: z.string().trim().min(1, 'subjectMatterId must not be blank'),
  createdAt: zodDate().default(() => new Date()),
})

export type GradeLevelSubjectMatterData = z.infer<typeof gradeLevelSubjectMatterSchema>
export type GradeLevelSubjectMatterInput = z.input<typeof gradeLevelSubjectMatterSchema>

export const gradeLevelSubjectMatterCreateSchema = gradeLevelSubjectMatterSchema.omit({ createdAt: true })
export const gradeLevelSubjectMatterUpdateSchema = gradeLevelSubjectMatterSchema.partial().required({ id: true })

/**
 * Links a programme chapter to a grade-level subject offering.
 * Mirrored onto each class ClassSubjectMatter during sync.
 */
export class GradeLevelSubjectMatter {
  readonly data: GradeLevelSubjectMatterData

  constructor(args: GradeLevelSubjectMatterInput) {
    this.data = parseDomain(gradeLevelSubjectMatterSchema, args)
  }

  get id() { return this.data.id }
  get gradeLevelSubjectId() { return this.data.gradeLevelSubjectId }
  get subjectMatterId() { return this.data.subjectMatterId }
  get createdAt() { return this.data.createdAt }
}
