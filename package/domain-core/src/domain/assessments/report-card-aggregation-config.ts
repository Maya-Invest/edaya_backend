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
})

export type ReportCardAggregation = z.infer<typeof reportCardAggregationSchema>
export type ReportCardAggregationInput = z.input<typeof reportCardAggregationSchema>

export function weightForPeriod(aggregation: ReportCardAggregation, periodId: string): number {
  return aggregation.periodWeightsByPeriodId?.[periodId] ?? 1
}
