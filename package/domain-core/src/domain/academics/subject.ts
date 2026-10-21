import { z } from 'zod'

import { BusinessRuleViolationError } from '../shared/business-rule-error'
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
  gradeLevelId: z.string().trim().min(1, 'gradeLevelId must not be blank'),
  academicYearId: z.string().trim().min(1, 'academicYearId must not be blank'),
  name: z.string().trim().min(1, 'name must not be blank'),
  shortName: z.string().trim().min(1, 'shortName must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  code: z.string().trim().min(1, 'code must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  coefficient: z.number().positive().nullable().optional().transform(v => v ?? undefined),
  periodsPerWeek: z.number().int().positive().nullable().optional().transform(v => v ?? undefined),
  minPeriodSpan: z.number().int().positive().nullable().optional().transform(v => v ?? undefined),
  maxPeriodSpan: z.number().int().positive().nullable().optional().transform(v => v ?? undefined),
  isOptional: z.boolean().default(false),
  disciplineId: z.string().trim().min(1).nullable().optional().transform(v => v ?? undefined),
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
 * A curriculum subject owned by one school, grade level and academic year.
 * ClassSubject represents its delivery in each matching class.
 */
export class Subject {
  readonly data: SubjectData

  constructor(args: SubjectInput) {
    this.data = parseDomain(subjectSchema, subjectConstructorArgs(args))
    if (this.data.minPeriodSpan !== undefined && this.data.maxPeriodSpan !== undefined
      && this.data.maxPeriodSpan < this.data.minPeriodSpan) {
      throw new BusinessRuleViolationError('SUBJECT_PERIOD_SPAN_INVALID', 'maxPeriodSpan must be greater than or equal to minPeriodSpan')
    }
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get gradeLevelId() { return this.data.gradeLevelId }
  get academicYearId() { return this.data.academicYearId }
  get name() { return this.data.name }
  get shortName() { return this.data.shortName }
  get displayShortName() { return this.data.shortName ?? this.data.name }
  get code() { return this.data.code }
  get coefficient() { return this.data.coefficient }
  get periodsPerWeek() { return this.data.periodsPerWeek }
  get minPeriodSpan() { return this.data.minPeriodSpan }
  get maxPeriodSpan() { return this.data.maxPeriodSpan }
  get isOptional() { return this.data.isOptional }
  get disciplineId() { return this.data.disciplineId }
  get categoryId() { return this.data.categoryId }
  get color() { return this.data.color }
  get createdAt() { return this.data.createdAt }

  copyWith(overrides: Partial<SubjectInput>): Subject {
    return new Subject({
      id: this.id,
      schoolId: this.schoolId,
      gradeLevelId: this.gradeLevelId,
      academicYearId: this.academicYearId,
      name: overrides.name ?? this.name,
      shortName: overrides.shortName !== undefined ? overrides.shortName : this.shortName,
      code: overrides.code !== undefined ? overrides.code : this.code,
      coefficient: overrides.coefficient !== undefined ? overrides.coefficient : this.coefficient,
      periodsPerWeek: overrides.periodsPerWeek !== undefined ? overrides.periodsPerWeek : this.periodsPerWeek,
      minPeriodSpan: overrides.minPeriodSpan !== undefined ? overrides.minPeriodSpan : this.minPeriodSpan,
      maxPeriodSpan: overrides.maxPeriodSpan !== undefined ? overrides.maxPeriodSpan : this.maxPeriodSpan,
      isOptional: overrides.isOptional ?? this.isOptional,
      disciplineId: overrides.disciplineId !== undefined ? overrides.disciplineId : this.disciplineId,
      categoryId: overrides.categoryId
        ?? (overrides.category
          ? defaultSubjectCategoryId(this.schoolId, overrides.category)
          : this.categoryId),
      color: overrides.color ?? this.color,
      createdAt: this.createdAt,
    })
  }
}
