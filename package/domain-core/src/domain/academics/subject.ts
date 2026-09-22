import { z } from 'zod'

import { parseDomain, zodDate } from '../shared/utils'
import { defaultSubjectCategoryId, SubjectCategory } from './subject-category'

export enum SubjectColor {
  Mint = 'mint',
  Sky = 'sky',
  Warm = 'warm',
}

export const subjectSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  name: z.string().trim().min(1, 'name must not be blank'),
  shortName: z.string().trim().min(1, 'shortName must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  code: z.string().trim().min(1, 'code must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  defaultCoefficient: z.number().positive('defaultCoefficient must be a finite, positive number').nullable().optional().transform(v => v === null ? undefined : v),
  categoryId: z.string().trim().min(1, 'categoryId must not be blank'),
  color: z.nativeEnum(SubjectColor).default(SubjectColor.Mint),
  createdAt: zodDate().default(() => new Date()),
})

export type SubjectData = z.infer<typeof subjectSchema>
export type SubjectInput = Omit<z.input<typeof subjectSchema>, 'categoryId'> & {
  categoryId?: string
  /** Legacy name used by seeds. Resolved to categoryId for the school. */
  category?: string
}

function subjectConstructorArgs(args: SubjectInput): z.input<typeof subjectSchema> {
  const { category, categoryId, ...rest } = args
  return {
    ...rest,
    categoryId: categoryId?.trim()
      || defaultSubjectCategoryId(args.schoolId, category?.trim() || SubjectCategory.Scientific),
  }
}

export const subjectCreateSchema = subjectSchema.omit({ createdAt: true })
export const subjectUpdateSchema = subjectSchema.partial().required({ id: true })

/**
 * Represents a learning subject (e.g., Mathematics, History) in the global school catalog.
 * Subjects are linked to classGroups and assigned staff through ClassSubject.
 */
export class Subject {
  readonly data: SubjectData

  constructor(args: SubjectInput) {
    this.data = parseDomain(subjectSchema, subjectConstructorArgs(args))
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get name() { return this.data.name }
  get shortName() { return this.data.shortName }
  get displayShortName() { return this.data.shortName ?? this.data.name }
  get code() { return this.data.code }
  get defaultCoefficient() { return this.data.defaultCoefficient }
  get categoryId() { return this.data.categoryId }
  get color() { return this.data.color }
  get createdAt() { return this.data.createdAt }

  copyWith(overrides: Partial<SubjectInput>): Subject {
    return new Subject({
      id: this.id,
      schoolId: this.schoolId,
      name: overrides.name ?? this.name,
      shortName: overrides.shortName !== undefined ? overrides.shortName : this.shortName,
      code: overrides.code !== undefined ? overrides.code : this.code,
      defaultCoefficient: overrides.defaultCoefficient !== undefined ? overrides.defaultCoefficient : this.defaultCoefficient,
      categoryId: overrides.categoryId
        ?? (overrides.category
          ? defaultSubjectCategoryId(this.schoolId, overrides.category)
          : this.categoryId),
      color: overrides.color ?? this.color,
      createdAt: this.createdAt,
    })
  }
}
