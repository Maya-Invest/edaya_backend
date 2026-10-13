import { z } from 'zod'

import { parseDomain, zodDate } from '../shared/utils'
import { currentGradingPolicy, gradingPolicySchema } from './grading-policy'

export const gradeLevelSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  gradingPolicies: z.array(gradingPolicySchema).default([]),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  name: z.string().trim().min(1, 'name must not be blank'),
  /** Short human-readable stem used to build class names (e.g. `6ème` for `6ème 1`). */
  label: z.string().trim().min(1, 'label must not be blank'),
  order: z.number().int('order must be a strictly positive integer').positive('order must be a strictly positive integer'),
  cycle: z.string().trim().min(1, 'cycle must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

export type GradeLevelData = z.infer<typeof gradeLevelSchema>
export type GradeLevelInput = z.input<typeof gradeLevelSchema>

export const gradeLevelCreateSchema = gradeLevelSchema.omit({ createdAt: true })
export const gradeLevelUpdateSchema = gradeLevelSchema.partial().required({ id: true })

/**
 * Represents a formal grade level in the school's progression ladder
 * (e.g., CP1, CE1, Grade 10). ClassGroups reference a GradeLevel
 * to provide structured level tracking and promotion logic.
 */
export class GradeLevel {
  readonly data: GradeLevelData

  constructor(args: GradeLevelInput) {
    this.data = parseDomain(gradeLevelSchema, args)
  }

  get id() { return this.data.id }
  get gradingPolicies() { return this.data.gradingPolicies }
  gradingPolicyFor(academicYearId: string) { return currentGradingPolicy(this.gradingPolicies, academicYearId) }
  get schoolId() { return this.data.schoolId }
  get name() { return this.data.name }
  get label() { return this.data.label }
  get order() { return this.data.order }
  get cycle() { return this.data.cycle }
  get createdAt() { return this.data.createdAt }
}
