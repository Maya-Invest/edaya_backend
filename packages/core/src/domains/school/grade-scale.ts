import type { SchoolRepositories } from '../../ports/school-repositories'
import type { EntityConfigFactory } from '../../shared'
import { z } from 'zod'
import { Permission } from '../../authorization'
import { config, directSchoolTenant, noopDeleteAccess, noopReadAccess, noopSaveAccess, permissionAction, read, write } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { requireSchool } from '../../shared/require-school'
import { DomainValidationError, formatZodError, roundTo2, zodDate } from '../utils'

export interface GradeScaleRange {
  letter: string // e.g. "A" or "Assez Bien"
  minScore: number
  maxScore: number
  gpaValue?: number | null
  interpretation?: string | null
  isPassing: boolean
}

export const gradeScaleRangeSchema = z.object({
  letter: z.string().trim().min(1, 'letter must not be blank'),
  minScore: z.number().finite().nonnegative('minScore must be a finite, non-negative number').transform(v => roundTo2(v)),
  maxScore: z.number().finite().nonnegative('maxScore must be a finite, non-negative number').transform(v => roundTo2(v)),
  gpaValue: z.number().finite().nonnegative('gpaValue must be a finite, non-negative number').transform(v => roundTo2(v)).nullable().optional().transform(v => v === null ? undefined : v),
  interpretation: z.string().trim().min(1, 'interpretation must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  isPassing: z.boolean(),
})

export const gradeScaleBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  name: z.string().trim().min(1, 'name must not be blank'),
  minScore: z.number().finite().nonnegative('minScore must be a finite, non-negative number').transform(v => roundTo2(v)),
  maxScore: z.number().finite().nonnegative('maxScore must be a finite, non-negative number').transform(v => roundTo2(v)),
  isDefault: z.boolean().default(false),
  createdAt: zodDate().default(() => new Date()),
})

function refineGradeScale(data: any, ctx: z.RefinementCtx) {
  if (data.minScore > data.maxScore) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'minScore must not exceed maxScore',
    })
  }
  if (!data.ranges || data.ranges.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'ranges must contain at least one range',
    })
    return
  }
  for (const [index, range] of data.ranges.entries()) {
    if (range.minScore > range.maxScore) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `ranges[${index}].minScore must not exceed its maxScore`,
      })
    }
    if (range.minScore < data.minScore || range.maxScore > data.maxScore) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `ranges[${index}] must fall within the grade scale bounds`,
      })
    }
    if (index > 0) {
      const previousRange = data.ranges[index - 1]
      if (previousRange && range.minScore <= previousRange.maxScore) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'ranges must be ordered by score and must not overlap',
        })
      }
    }
  }
}

export const gradeScaleSchema = gradeScaleBaseSchema.extend({
  ranges: gradeScaleRangeSchema.array().transform(arr => Object.freeze(arr.map(r => Object.freeze(r)))),
}).superRefine(refineGradeScale)

export type GradeScaleData = Omit<z.infer<typeof gradeScaleSchema>, 'ranges'> & {
  readonly ranges: readonly GradeScaleRange[]
}

export const gradeScaleCreateSchema = gradeScaleBaseSchema.extend({
  ranges: gradeScaleRangeSchema.array(),
}).omit({ createdAt: true }).superRefine(refineGradeScale)

export const gradeScaleUpdateSchema = gradeScaleBaseSchema.extend({
  ranges: gradeScaleRangeSchema.array(),
}).partial().required({ id: true }).superRefine(refineGradeScale)

export interface GradeScaleArgs {
  id: string
  schoolId: string
  name: string
  minScore: number
  maxScore: number
  ranges: readonly GradeScaleRange[]
  isDefault?: boolean
  createdAt?: Date
}

export class GradeScale {
  readonly data: GradeScaleData
  readonly ranges: readonly GradeScaleRange[]

  constructor(args: GradeScaleArgs) {
    const result = gradeScaleSchema.safeParse(args)
    if (!result.success) {
      throw new DomainValidationError(formatZodError(result.error))
    }
    this.data = result.data as any
    this.ranges = Object.freeze(args.ranges.map(r => Object.freeze({
      letter: r.letter,
      minScore: roundTo2(r.minScore),
      maxScore: roundTo2(r.maxScore),
      gpaValue: r.gpaValue == null ? undefined : roundTo2(r.gpaValue),
      interpretation: r.interpretation === null ? undefined : r.interpretation,
      isPassing: r.isPassing,
    })))
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get name() { return this.data.name }
  get minScore() { return this.data.minScore }
  get maxScore() { return this.data.maxScore }
  get isDefault() { return this.data.isDefault }
  get createdAt() { return this.data.createdAt }

  findRange(score: number): GradeScaleRange | undefined {
    return this.ranges.find(r => score >= r.minScore && score <= r.maxScore)
  }
}

export const gradeScaleConfig: EntityConfigFactory<GradeScale> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.gradeScales,
    tenant: directSchoolTenant(),
    read: read(permissionAction(policy, Permission.GRADE_READ), noopReadAccess),
    write: write(permissionAction(policy, Permission.EXAM_CONFIG_CONFIGURE), noopSaveAccess, noopDeleteAccess),
    gates: {
      preSave: validateGradeScaleSave,
    },
    atomicExecution,
  })

async function validateGradeScaleSave(
  gradeScale: GradeScale,
  _existing: GradeScale | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  await requireSchool(repositories.schools, gradeScale.schoolId)
  if (!gradeScale.isDefault)
    return

  const existingDefault = await repositories.gradeScales.findOne({
    schoolId: gradeScale.schoolId,
    isDefault: true,
  })
  if (existingDefault && existingDefault.id !== gradeScale.id) {
    throw new BusinessRuleViolationError(
      'DEFAULT_GRADE_SCALE_ALREADY_EXISTS',
      `School ${gradeScale.schoolId} already has a default grade scale`,
    )
  }
}
