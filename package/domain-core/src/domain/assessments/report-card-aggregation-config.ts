import { z } from 'zod'

export enum ReportCardAggregationSource {
  Assessments = 'assessments',
  ReportCards = 'report_cards',
}

export const reportCardAggregationSchema = z.object({
  source: z.nativeEnum(ReportCardAggregationSource),
  sourcePeriodIds: z.array(z.string().trim().min(1)).min(1, 'sourcePeriodIds must contain at least one period'),
  periodWeightsByPeriodId: z.record(
    z.string().trim().min(1),
    z.number().finite().positive('period weight must be a finite, strictly positive number'),
  ).optional(),
  /** Captured by generation, never trusted from a command caller. Stored in existing aggregation JSON. */
  sourceReportVersions: z.array(z.object({
    periodId: z.string().min(1),
    resultId: z.string().min(1),
    version: z.number().int().nonnegative(),
    sourceVersion: z.string().min(1),
  })).optional(),
})

export type ReportCardAggregation = z.infer<typeof reportCardAggregationSchema>
export type ReportCardAggregationInput = z.input<typeof reportCardAggregationSchema>

export function weightForPeriod(aggregation: ReportCardAggregation, periodId: string): number {
  return aggregation.periodWeightsByPeriodId?.[periodId] ?? 1
}
