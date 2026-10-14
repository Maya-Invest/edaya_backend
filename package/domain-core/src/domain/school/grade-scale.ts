import { z } from 'zod'

import { parseDomain, zodDate } from '../shared/utils'

export const gradeScaleRangeSchema = z.object({
  id: z.string().trim().min(1).optional(),
  letter: z.string().trim().min(1, 'letter must not be blank'),
  minScore: z.number().finite().nonnegative(),
  maxScore: z.number().finite().nonnegative(),
  gpaValue: z.number().finite().nonnegative().nullable().optional().transform(v => v === null ? undefined : v),
  interpretation: z.string().trim().min(1, 'interpretation must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  isPassing: z.boolean(),
})
export type GradeScaleRange = z.infer<typeof gradeScaleRangeSchema>

export const gradeScaleBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  name: z.string().trim().min(1, 'name must not be blank'),
  minScore: z.number().finite().nonnegative('minScore must be a finite, non-negative number'),
  maxScore: z.number().finite().nonnegative('maxScore must be a finite, non-negative number'),
  decimalPlaces: z.number().int().min(0, 'decimalPlaces must be between 0 and 3').max(3, 'decimalPlaces must be between 0 and 3').default(1),
  roundingMode: z.enum(['nearest', 'truncate']).default('nearest'),
  /** Legacy closed intervals remain readable until explicitly replaced. */
  intervalConvention: z.enum(['legacy-closed', 'continuous']).default('legacy-closed'),
  revision: z.number().int().nonnegative().default(0),
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
    if (data.intervalConvention === 'continuous' && !data.isDefault && data.minScore < data.maxScore) {
      for (const bound of [data.minScore, data.maxScore]) {
        const scaled = bound * 10 ** data.decimalPlaces
        if (Math.abs(scaled - Math.round(scaled)) > Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4)
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Scale bounds must be representable at the configured precision' })
      }
      return
    }
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
      if (previousRange && (data.intervalConvention === 'continuous' ? range.minScore !== previousRange.maxScore : range.minScore <= previousRange.maxScore)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: data.intervalConvention === 'continuous' ? 'ranges must be ordered, without overlaps or gaps' : 'ranges must be ordered by score and must not overlap',
        })
      }
    }
    if (data.intervalConvention === 'continuous' && (!range.id || !range.interpretation || range.minScore >= range.maxScore)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ranges', index], message: 'An interval requires a stable ID, label and increasing bounds' })
    }
    if (data.intervalConvention === 'continuous' && range.gpaValue !== undefined && (range.gpaValue < data.minScore || range.gpaValue > data.maxScore)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ranges', index, 'gpaValue'], message: 'Assigned points must be within the scale bounds' })
    }
  }
  if (data.intervalConvention === 'continuous') {
    for (const key of ['minScore', 'maxScore']) {
      const scaled = data[key] * 10 ** data.decimalPlaces
      if (!Number.isFinite(scaled) || Math.abs(scaled - Math.round(scaled)) > Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: 'Scale bounds must be representable at the configured precision' })
    }
    if (data.ranges[0].minScore !== data.minScore || data.ranges.at(-1).maxScore !== data.maxScore)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ranges'], message: 'Intervals must cover the entire scale' })
    for (const key of ['id', 'letter']) {
      if (new Set(data.ranges.map((range: GradeScaleRange) => range[key as 'id' | 'letter'])).size !== data.ranges.length)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ranges'], message: `Interval ${key} values must be unique` })
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
    this.ranges = this.data.ranges
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get name() { return this.data.name }
  get minScore() { return this.data.minScore }
  get maxScore() { return this.data.maxScore }
  get isDefault() { return this.data.isDefault }
  get decimalPlaces() { return this.data.decimalPlaces }
  get roundingMode() { return this.data.roundingMode }
  get intervalConvention() { return this.data.intervalConvention }
  get revision() { return this.data.revision }
  get description() { return this.data.description }
  get createdAt() { return this.data.createdAt }

  get isComplete(): boolean { return this.ranges.length > 0 }

  get passingScore(): number {
    const passingRanges = this.ranges.filter(range => range.isPassing)
    if (passingRanges.length === 0) {
      return this.minScore
    }
    return Math.min(...passingRanges.map(range => range.minScore))
  }

  findRange(score: number): GradeScaleRange | undefined {
    if (score < this.minScore || score > this.maxScore || !Number.isFinite(score))
      return undefined
    return this.ranges.find((r, index) => score >= r.minScore && (score < r.maxScore || (score === r.maxScore && (this.intervalConvention === 'legacy-closed' || index === this.ranges.length - 1))))
  }
}

/** Minimums are the authored values; upper bounds are compatibility output. */
export function rangesFromThresholds(ranges: readonly Omit<GradeScaleRange, 'maxScore'>[], maximum: number): GradeScaleRange[] {
  const ordered = [...ranges].sort((a, b) => a.minScore - b.minScore)
  return ordered.map((range, index) => ({ ...range, maxScore: ordered[index + 1]?.minScore ?? maximum }))
}
