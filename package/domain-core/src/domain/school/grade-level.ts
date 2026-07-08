import { z } from 'zod'

import { parseDomain, zodDate } from '../shared/utils'

export const gradeLevelSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  name: z.string().trim().min(1, 'name must not be blank'),
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
  get schoolId() { return this.data.schoolId }
  get name() { return this.data.name }
  get order() { return this.data.order }
  get cycle() { return this.data.cycle }
  get createdAt() { return this.data.createdAt }
}
