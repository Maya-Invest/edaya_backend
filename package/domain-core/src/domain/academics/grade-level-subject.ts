import { z } from 'zod'

import { parseDomain, zodDate } from '../shared/utils'

export const gradeLevelSubjectSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  gradeLevelId: z.string().trim().min(1, 'gradeLevelId must not be blank'),
  academicYearId: z.string().trim().min(1, 'academicYearId must not be blank'),
  subjectId: z.string().trim().min(1, 'subjectId must not be blank'),
  coefficient: z.number().positive('coefficient must be a finite, strictly positive number').nullable().optional().transform(v => v === null ? undefined : v),
  periodsPerWeek: z.number().int().positive('periodsPerWeek must be a strictly positive integer').nullable().optional().transform(v => v === null ? undefined : v),
  isOptional: z.boolean().default(false),
  createdAt: zodDate().default(() => new Date()),
})

export type GradeLevelSubjectData = z.infer<typeof gradeLevelSubjectSchema>
export type GradeLevelSubjectInput = z.input<typeof gradeLevelSubjectSchema>

export const gradeLevelSubjectCreateSchema = gradeLevelSubjectSchema.omit({ createdAt: true })
export const gradeLevelSubjectUpdateSchema = gradeLevelSubjectSchema.partial().required({ id: true })

/**
 * Represents a subject allocated to a grade level for an academic year.
 * All classes in that grade inherit mirrored ClassSubject rows via sync.
 */
export class GradeLevelSubject {
  readonly data: GradeLevelSubjectData

  constructor(args: GradeLevelSubjectInput) {
    this.data = parseDomain(gradeLevelSubjectSchema, args)
  }

  get id() { return this.data.id }
  get gradeLevelId() { return this.data.gradeLevelId }
  get academicYearId() { return this.data.academicYearId }
  get subjectId() { return this.data.subjectId }
  get coefficient() { return this.data.coefficient ?? undefined }
  get periodsPerWeek() { return this.data.periodsPerWeek ?? undefined }
  get isOptional() { return this.data.isOptional }
  get createdAt() { return this.data.createdAt }
}
