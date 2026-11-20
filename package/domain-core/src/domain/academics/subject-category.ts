import { z } from 'zod'

import { parseDomain, zodDate } from '../shared/utils'
import { shortNameSchema } from '../shared/visible-identification'

export const subjectCategorySchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  name: z.string().trim().min(1, 'name must not be blank'),
  shortName: shortNameSchema.optional(),
  createdAt: zodDate().default(() => new Date()),
})

export type SubjectCategoryData = z.infer<typeof subjectCategorySchema>
export type SubjectCategoryInput = z.input<typeof subjectCategorySchema>

export const subjectCategoryCreateSchema = subjectCategorySchema.omit({ createdAt: true })
export const subjectCategoryUpdateSchema = subjectCategorySchema.partial().required({ id: true })

export class SubjectCategoryEntity {
  readonly data: SubjectCategoryData

  constructor(args: SubjectCategoryInput) {
    this.data = parseDomain(subjectCategorySchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get name() { return this.data.name }
  get shortName() { return this.data.shortName ?? this.name }
  get createdAt() { return this.data.createdAt }

  copyWith(overrides: Partial<SubjectCategoryInput>): SubjectCategoryEntity {
    return new SubjectCategoryEntity({
      id: this.id,
      schoolId: this.schoolId,
      name: overrides.name ?? this.name,
      shortName: overrides.shortName ?? this.shortName,
      createdAt: this.createdAt,
    })
  }
}
