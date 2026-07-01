import type { EntityConfigFactory } from '../../application/entities/entity-config'
import type { SchoolRepositories } from '../../ports/repositories/school-repositories'
import { z } from 'zod'
import { config, directSchoolTenant, noopDeleteAccess, noopReadAccess, noopSaveAccess, permissionAction, read, write } from '../../application/entities/entity-config'
import { requireSchool } from '../../application/require-school'
import { Permission } from '../../capabilities/authorization'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
import { parseDomain, roundTo2, zodDate } from '../shared/utils'

export const gradeScaleRangeSchema = z.object({
  letter: z.string().trim().min(1, 'letter must not be blank'),
  minScore: z.number().finite().nonnegative('minScore must be a finite, non-negative number').transform(v => roundTo2(v)),
  maxScore: z.number().finite().nonnegative('maxScore must be a finite, non-negative number').transform(v => roundTo2(v)),
  gpaValue: z.number().finite().nonnegative('gpaValue must be a finite, non-negative number').transform(v => roundTo2(v)).nullable().optional().transform(v => v === null ? undefined : v),
  interpretation: z.string().trim().min(1, 'interpretation must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  isPassing: z.boolean(),
})
export type GradeScaleRange = z.infer<typeof gradeScaleRangeSchema>

export const gradeScaleBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  name: z.string().trim().min(1, 'name must not be blank'),
  minScore: z.number().finite().nonnegative('minScore must be a finite, non-negative number').transform(v => roundTo2(v)),
  maxScore: z.number().finite().nonnegative('maxScore must be a finite, non-negative number').transform(v => roundTo2(v)),
  decimalPlaces: z.number().int().min(0, 'decimalPlaces must be between 0 and 3').max(3, 'decimalPlaces must be between 0 and 3').default(1),
  description: z.string().trim().min(1, 'description must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
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
export type GradeScaleInput = z.input<typeof gradeScaleSchema>

export const gradeScaleCreateSchema = gradeScaleBaseSchema.extend({
  ranges: gradeScaleRangeSchema.array(),
}).omit({ createdAt: true }).superRefine(refineGradeScale)

export const gradeScaleUpdateSchema = gradeScaleBaseSchema.extend({
  ranges: gradeScaleRangeSchema.array(),
}).partial().required({ id: true }).superRefine(refineGradeScale)

export class GradeScale {
  readonly data: GradeScaleData
  readonly ranges: readonly GradeScaleRange[]

  constructor(args: GradeScaleInput) {
    this.data = parseDomain(gradeScaleSchema, args)
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
  get decimalPlaces() { return this.data.decimalPlaces }
  get description() { return this.data.description }
  get createdAt() { return this.data.createdAt }

  get passingScore(): number {
    const passingRanges = this.ranges.filter(range => range.isPassing)
    if (passingRanges.length === 0) {
      return this.minScore
    }
    return Math.min(...passingRanges.map(range => range.minScore))
  }

  findRange(score: number): GradeScaleRange | undefined {
    return this.ranges.find(r => score >= r.minScore && score <= r.maxScore)
  }
}

export const gradeScaleConfig: EntityConfigFactory<GradeScale> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.gradeScales,
    tenant: directSchoolTenant(),
    read: read(permissionAction(Permission.GRADE_READ), noopReadAccess),
    write: write(permissionAction(Permission.EXAM_CONFIG_CONFIGURE), noopSaveAccess, noopDeleteAccess),
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
