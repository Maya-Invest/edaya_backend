import { z } from 'zod'
import { GradeScale, gradeScaleSchema } from './grade-scale'

export const gradingModeSchema = z.enum(['numeric-first', 'mention-first'])
export const originalGradeEntrySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('numeric'), value: z.number().finite().nonnegative(), maximum: z.number().finite().positive() }),
  z.object({ kind: z.literal('mention'), intervalId: z.string().min(1), code: z.string().min(1), label: z.string().min(1), policyRevision: z.number().int().positive(), points: z.number().finite().nonnegative() }),
])
export type OriginalGradeEntry = z.infer<typeof originalGradeEntrySchema>

/** A snapshot belongs to one level/year. Editing a reusable scale never changes it. */
export const gradingPolicySchema = z.object({
  academicYearId: z.string().min(1),
  revision: z.number().int().positive(),
  mode: gradingModeSchema,
  aggregateLabel: z.string().trim().min(1).max(100),
  scale: gradeScaleSchema.transform(scale => ({ ...scale, ranges: [...scale.ranges] })),
  numericEquivalents: z.record(z.number().finite().nonnegative()).default({}),
  status: z.enum(['updating', 'completed', 'failed']).default('updating'),
  workId: z.string().optional(),
  failureCode: z.string().optional(),
  /** Durable cursor; one transaction processes at most one bounded page. */
  cursor: z.object({ phase: z.enum(['marks', 'reports', 'annual', 'rankings', 'done']), classId: z.string().default(''), assessmentId: z.string().default(''), afterId: z.string().default('') }).optional(),
}).superRefine((policy, ctx) => {
  if (policy.scale.intervalConvention !== 'continuous')
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['scale'], message: 'Apply a scale with complete continuous intervals' })
  if (policy.scale.minScore !== 0 || policy.scale.maxScore <= 0)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['scale'], message: 'An aggregation scale must start at zero and have a positive maximum' })
  if (policy.mode === 'mention-first' && policy.scale.ranges.some(range => range.gpaValue === undefined))
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['scale', 'ranges'], message: 'Every mention requires assigned points' })
  if (Object.values(policy.numericEquivalents).some(value => value > policy.scale.maxScore))
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['numericEquivalents'], message: 'Numeric equivalents must be within the aggregation scale' })
})
export type GradingPolicy = z.infer<typeof gradingPolicySchema>
export type GradingPolicyInput = z.input<typeof gradingPolicySchema>

export function currentGradingPolicy(policies: readonly GradingPolicy[], academicYearId: string): GradingPolicy | undefined {
  return policies.filter(policy => policy.academicYearId === academicYearId).reduce<GradingPolicy | undefined>((current, policy) => !current || policy.revision > current.revision ? policy : current, undefined)
}

export const calculatedGradeSchema = z.object({
  policyRevision: z.number().int().positive(),
  scaleId: z.string(),
  scaleRevision: z.number().int().nonnegative(),
  mode: gradingModeSchema,
  maximum: z.number().finite().positive(),
  decimalPlaces: z.number().int().min(0).max(3).default(2),
  roundingMode: z.enum(['nearest', 'truncate']).default('nearest'),
  units: z.enum(['numeric', 'points']),
  value: z.number().finite().nonnegative(),
  reportedValue: z.number().finite().nonnegative(),
  mention: z.object({ id: z.string(), code: z.string(), label: z.string(), isPassing: z.boolean() }),
  provenance: z.enum(['numeric-normalization', 'mention-points', 'explicit-equivalent']),
})
export type CalculatedGrade = z.infer<typeof calculatedGradeSchema>

export function roundGrade(value: number, scale: Pick<GradingPolicy['scale'], 'decimalPlaces' | 'roundingMode'>): number {
  const factor = 10 ** scale.decimalPlaces
  const scaled = value * factor
  // Compensate only for binary representation at an exact decimal boundary.
  const epsilon = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4
  return (scale.roundingMode === 'truncate' ? Math.trunc(scaled + epsilon) : Math.round(scaled + epsilon)) / factor
}

export function describeGrade(value: number, policy: GradingPolicy, provenance: CalculatedGrade['provenance'] = 'numeric-normalization'): CalculatedGrade {
  const reportedValue = roundGrade(value, policy.scale)
  const range = new GradeScale(policy.scale).findRange(reportedValue)
  if (!range?.id)
    throw new Error('GRADING_VALUE_OUTSIDE_SCALE')
  return { policyRevision: policy.revision, scaleId: policy.scale.id, scaleRevision: policy.scale.revision, mode: policy.mode, decimalPlaces: policy.scale.decimalPlaces, roundingMode: policy.scale.roundingMode, maximum: policy.scale.maxScore, units: policy.mode === 'mention-first' ? 'points' : 'numeric', value, reportedValue, mention: { id: range.id, code: range.letter, label: range.interpretation ?? range.letter, isPassing: range.isPassing }, provenance }
}

export function calculateGrade(entry: OriginalGradeEntry, policy: GradingPolicy): CalculatedGrade {
  if (entry.kind === 'numeric')
    return describeGrade(entry.value / entry.maximum * policy.scale.maxScore, policy)
  if (policy.mode === 'numeric-first') {
    const value = policy.numericEquivalents[`${entry.policyRevision}:${entry.intervalId}`]
    if (value === undefined)
      throw new Error('GRADING_NUMERIC_EQUIVALENT_REQUIRED')
    return describeGrade(value, policy, 'explicit-equivalent')
  }
  const range = policy.scale.ranges.find(range => range.id === entry.intervalId)
  return describeGrade(range?.gpaValue ?? entry.points, policy, 'mention-points')
}

export function weightedGrade(values: readonly { value: number, coefficient: number }[]): number | undefined {
  const weight = values.reduce((sum, row) => sum + row.coefficient, 0)
  return weight > 0 ? values.reduce((sum, row) => sum + row.value * row.coefficient, 0) / weight : undefined
}
