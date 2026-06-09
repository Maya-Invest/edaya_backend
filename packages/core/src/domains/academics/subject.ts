import type { EntityConfigFactory } from '../../shared'
import { z } from 'zod'
import { Permission } from '../../authorization'
import { directPermissionEntityConfig } from '../../shared'
import { DomainValidationError, formatZodError, zodDate } from '../utils'

export const subjectSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  name: z.string().trim().min(1, 'name must not be blank'),
  code: z.string().trim().min(1, 'code must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  defaultCoefficient: z.number().positive('defaultCoefficient must be a finite, positive number').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

export type SubjectData = z.infer<typeof subjectSchema>

export const subjectCreateSchema = subjectSchema.omit({ createdAt: true })
export const subjectUpdateSchema = subjectSchema.partial().required({ id: true })

export interface SubjectArgs {
  id: string
  schoolId: string
  name: string
  code?: string | null
  defaultCoefficient?: number | null
  createdAt?: Date
}

/**
 * Represents a learning subject (e.g., Mathematics, History) in the global school catalog.
 * Subjects are linked to classGroups and assigned staff through ClassSubject.
 */
export class Subject {
  readonly data: SubjectData

  constructor(args: SubjectArgs) {
    const result = subjectSchema.safeParse(args)
    if (!result.success) {
      throw new DomainValidationError(formatZodError(result.error))
    }
    this.data = result.data
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get name() { return this.data.name }
  get code() { return this.data.code }
  get defaultCoefficient() { return this.data.defaultCoefficient }
  get createdAt() { return this.data.createdAt }

  copyWith(overrides: Partial<SubjectArgs>): Subject {
    return new Subject({
      id: this.id,
      schoolId: this.schoolId,
      name: overrides.name ?? this.name,
      code: overrides.code !== undefined ? overrides.code : this.code,
      defaultCoefficient: overrides.defaultCoefficient !== undefined ? overrides.defaultCoefficient : this.defaultCoefficient,
      createdAt: this.createdAt,
    })
  }
}

export const subjectConfig: EntityConfigFactory<Subject> = input =>
  directPermissionEntityConfig(
    input,
    input.repositories.subjects,
    Permission.QUERY_CLASS_CURRICULUM_READ,
    Permission.ACADEMIC_PROGRAM_UPDATE,
  )
