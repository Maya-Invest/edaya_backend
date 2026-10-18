import { z } from 'zod'

import { parseDomain, zodDate } from '../shared/utils'

export const classSubjectSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  classGroupId: z.string().trim().min(1, 'classGroupId must not be blank'),
  subjectId: z.string().trim().min(1, 'subjectId must not be blank'),
  coefficient: z.number().positive('coefficient must be a finite, strictly positive number').nullable().optional().transform(v => v === null ? undefined : v),
  periodsPerWeek: z.number().int().positive('periodsPerWeek must be a strictly positive integer').nullable().optional().transform(v => v === null ? undefined : v),
  minPeriodSpan: z.number().int().positive('minPeriodSpan must be a strictly positive integer').nullable().optional().transform(v => v === null ? undefined : v),
  maxPeriodSpan: z.number().int().positive('maxPeriodSpan must be a strictly positive integer').nullable().optional().transform(v => v === null ? undefined : v),
  completedPercentage: z.preprocess(
    val => val === null ? undefined : val,
    z.number().min(0, 'completedPercentage must be a finite, non-negative number').max(100, 'completedPercentage must be between 0 and 100').default(0),
  ),
  isOffered: z.boolean().default(true),
  createdAt: zodDate().default(() => new Date()),
})

export type ClassSubjectData = z.infer<typeof classSubjectSchema>
export type ClassSubjectInput = z.input<typeof classSubjectSchema>

export const classSubjectCreateSchema = classSubjectSchema.omit({ createdAt: true })
export const classSubjectUpdateSchema = classSubjectSchema.partial().required({ id: true })

/**
 * Represents a concrete subject offering inside a classGroup for an academic year.
 * This is the teachable unit used by assessments, attendance planning, and staff assignment.
 */
export class ClassSubject {
  readonly data: ClassSubjectData

  constructor(args: ClassSubjectInput) {
    this.data = parseDomain(classSubjectSchema, args)
  }

  get id() { return this.data.id }
  get classGroupId() { return this.data.classGroupId }
  get subjectId() { return this.data.subjectId }
  get coefficient() { return this.data.coefficient ?? undefined }
  get periodsPerWeek() { return this.data.periodsPerWeek ?? undefined }
  get minPeriodSpan() { return this.data.minPeriodSpan ?? undefined }
  get maxPeriodSpan() { return this.data.maxPeriodSpan ?? undefined }
  get createdAt() { return this.data.createdAt }
  get completedPercentage() { return this.data.completedPercentage }
  get isOffered() { return this.data.isOffered }
}
