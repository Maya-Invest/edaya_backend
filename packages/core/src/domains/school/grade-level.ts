import type { EntityConfigFactory } from '../../shared'
import { z } from 'zod'
import { Permission } from '../../authorization'
import { directPermissionEntityConfig } from '../../shared'
import { DomainValidationError, formatZodError, zodDate } from '../utils'

export const gradeLevelSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  name: z.string().trim().min(1, 'name must not be blank'),
  order: z.number().int('order must be a strictly positive integer').positive('order must be a strictly positive integer'),
  cycle: z.string().trim().min(1, 'cycle must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

export type GradeLevelData = z.infer<typeof gradeLevelSchema>

export const gradeLevelCreateSchema = gradeLevelSchema.omit({ createdAt: true })
export const gradeLevelUpdateSchema = gradeLevelSchema.partial().required({ id: true })

export interface GradeLevelArgs {
  id: string
  schoolId: string
  name: string
  order: number
  cycle?: string | null
  createdAt?: Date
}

/**
 * Represents a formal grade level in the school's progression ladder
 * (e.g., CP1, CE1, Grade 10). ClassGroups reference a GradeLevel
 * to provide structured level tracking and promotion logic.
 */
export class GradeLevel {
  readonly data: GradeLevelData

  constructor(args: GradeLevelArgs) {
    const result = gradeLevelSchema.safeParse(args)
    if (!result.success) {
      throw new DomainValidationError(formatZodError(result.error))
    }
    this.data = result.data
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get name() { return this.data.name }
  get order() { return this.data.order }
  get cycle() { return this.data.cycle }
  get createdAt() { return this.data.createdAt }
}

export const gradeLevelConfig: EntityConfigFactory<GradeLevel> = input =>
  directPermissionEntityConfig(
    input,
    input.repositories.gradeLevels,
    Permission.QUERY_CLASS_DIRECTORY_READ,
    Permission.SCHOOL_STRUCTURE_CONFIGURE,
  )
