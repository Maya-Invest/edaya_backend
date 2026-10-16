import type { ReportCardResultSection } from './report-card-result-section'

import { z } from 'zod'

import { AttendanceSummary, attendanceSummarySchema } from '../../domain/value-objects/attendance-summary'

import { calculatedGradeSchema } from '../school/grading-policy'

import { parseDomain, roundTo2, zodDate } from '../shared/utils'

import { reportCardAggregationSchema } from './report-card-aggregation-config'

import { reportCardResultSectionSchema } from './report-card-result-section'

export enum ReportCardResultStatus {
  Draft = 'draft',
  Published = 'published',
}

export const reportCardResultBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  version: z.number().int().nonnegative().default(0),
  sourceMarks: z.array(z.object({ resultId: z.string(), assessmentId: z.string(), revision: z.number().int().nonnegative() })).default([]),
  pendingCorrectionIds: z.array(z.string()).default([]),
  sourceAssessments: z.array(z.object({ assessmentId: z.string(), revision: z.number().int().nonnegative() })).default([]),
  pendingAssessmentIds: z.array(z.string()).default([]),
  calculationStale: z.boolean().default(false),
  grading: calculatedGradeSchema.optional(),
  aggregateLabel: z.string().optional(),
  gradingPolicyRevision: z.number().int().positive().optional(),
  reportCardDefinitionId: z.string().trim().min(1, 'reportCardDefinitionId must not be blank'),
  studentId: z.string().trim().min(1, 'studentId must not be blank'),
  classGroupId: z.string().trim().min(1, 'classGroupId must not be blank'),
  periodId: z.string().trim().min(1, 'periodId must not be blank'),
  attendanceSummary: attendanceSummarySchema.transform(data => new AttendanceSummary(data)),
  assessmentResultCount: z.number().int().nonnegative('assessmentResultCount must be a non-negative integer'),
  overallAverage: z.number().finite().nonnegative('overallAverage must be a finite, non-negative number').nullable().optional().transform(v => v === null ? undefined : v),
  rank: z.number().int().nonnegative('rank must be a non-negative integer').nullable().optional().transform(v => v === null ? undefined : v),
  classSize: z.number().int().nonnegative('classSize must be a non-negative integer').nullable().optional().transform(v => v === null ? undefined : v),
  passThreshold: z.number().finite().nonnegative('passThreshold must be a finite, non-negative number').nullable().optional().transform(v => v === null ? undefined : v),
  teacherComment: z.string().trim().min(1, 'teacherComment must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  principalComment: z.string().trim().min(1, 'principalComment must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  status: z.nativeEnum(ReportCardResultStatus).default(ReportCardResultStatus.Draft),
  generatedAt: zodDate().default(() => new Date()),
  publishedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  aggregation: reportCardAggregationSchema.nullable().optional().transform(v => v === null ? undefined : v),
})

function refineReportCardResult(data: any, ctx: z.RefinementCtx) {
  if (data.status === ReportCardResultStatus.Published && !data.publishedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'publishedAt is required for published report cards',
    })
  }
  if (data.status === ReportCardResultStatus.Draft && data.publishedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'draft report cards must not define publishedAt',
    })
  }
}

export const reportCardSnapshotSchema = reportCardResultBaseSchema.extend({
  sectionResults: reportCardResultSectionSchema.array(),
})

export const reportCardResultSchema = reportCardResultBaseSchema.extend({
  revisedDraft: reportCardSnapshotSchema.optional(),
  publicationHistory: reportCardSnapshotSchema.array().default([]),
  sectionResults: reportCardResultSectionSchema.array(),
}).superRefine(refineReportCardResult)

export type ReportCardResultData = Omit<z.infer<typeof reportCardResultSchema>, 'sectionResults'> & {
  readonly sectionResults: readonly ReportCardResultSection[]
}
export type ReportCardResultInput = z.input<typeof reportCardResultSchema>

export const reportCardResultCreateSchema = reportCardResultBaseSchema.extend({
  sectionResults: reportCardResultSectionSchema.array(),
}).omit({ generatedAt: true }).superRefine(refineReportCardResult)

export const reportCardResultUpdateSchema = reportCardResultBaseSchema.extend({
  sectionResults: reportCardResultSectionSchema.array(),
}).partial().required({ id: true }).superRefine(refineReportCardResult)

/**
 * Represents a student's official report card for a specific academic period.
 * Contains a hierarchical tree of section results (grouping and leaf) that
 * collectively describe the student's academic performance.
 */
export class ReportCardResult {
  readonly data: ReportCardResultData
  readonly sectionResults: readonly ReportCardResultSection[]

  constructor(args: ReportCardResultInput) {
    this.data = parseDomain(reportCardResultSchema, { ...args, overallAverage: args.grading || args.overallAverage == null ? args.overallAverage : roundTo2(args.overallAverage) })
    this.sectionResults = Object.freeze([...args.sectionResults])
  }

  get revisedDraft() { return this.data.revisedDraft }
  get publicationHistory() { return this.data.publicationHistory }
  get grading() { return this.data.grading }
  get aggregateLabel() { return this.data.aggregateLabel }
  get gradingPolicyRevision() { return this.data.gradingPolicyRevision }
  get id() { return this.data.id }
  get version() { return this.data.version }
  get sourceMarks() { return this.data.sourceMarks }
  get pendingCorrectionIds() { return this.data.pendingCorrectionIds }
  get sourceAssessments() { return this.data.sourceAssessments }
  get pendingAssessmentIds() { return this.data.pendingAssessmentIds }
  get calculationStale() { return this.data.calculationStale }
  get reportCardDefinitionId() { return this.data.reportCardDefinitionId }
  get studentId() { return this.data.studentId }
  get classGroupId() { return this.data.classGroupId }
  get periodId() { return this.data.periodId }
  get attendanceSummary() { return this.data.attendanceSummary }
  get assessmentResultCount() { return this.data.assessmentResultCount }
  get overallAverage() { return this.data.overallAverage }
  get rank() { return this.data.rank }
  get classSize() { return this.data.classSize }
  get passThreshold() { return this.data.passThreshold }
  /** Classification belongs only to this captured report's overall average. */
  get isPassing(): boolean | undefined {
    return this.passThreshold === undefined || this.overallAverage === undefined ? undefined : this.overallAverage >= this.passThreshold
  }

  get teacherComment() { return this.data.teacherComment }
  get principalComment() { return this.data.principalComment }
  get status() { return this.data.status }
  get generatedAt() { return this.data.generatedAt }
  get publishedAt() { return this.data.publishedAt }
  get aggregation() { return this.data.aggregation }

  copyWith({
    status,
    publishedAt,
    generatedAt,
    aggregation,
  }: {
    status?: ReportCardResultStatus
    /** Pass `null` to clear a previously published timestamp (e.g. regenerate → draft). */
    publishedAt?: Date | null
    generatedAt?: Date
    aggregation?: ReportCardResultData['aggregation']
  }): ReportCardResult {
    return new ReportCardResult({
      ...this.data,
      version: this.version,
      sourceMarks: this.sourceMarks,
      pendingCorrectionIds: this.pendingCorrectionIds,
      sourceAssessments: this.sourceAssessments,
      pendingAssessmentIds: this.pendingAssessmentIds,
      calculationStale: this.calculationStale,
      id: this.id,
      reportCardDefinitionId: this.reportCardDefinitionId,
      studentId: this.studentId,
      classGroupId: this.classGroupId,
      periodId: this.periodId,
      sectionResults: [...this.sectionResults],
      attendanceSummary: this.attendanceSummary,
      assessmentResultCount: this.assessmentResultCount,
      overallAverage: this.overallAverage,
      rank: this.rank,
      classSize: this.classSize,
      passThreshold: this.passThreshold,
      teacherComment: this.teacherComment,
      principalComment: this.principalComment,
      status: status ?? this.status,
      generatedAt: generatedAt ?? this.generatedAt,
      publishedAt: publishedAt === null ? undefined : (publishedAt ?? this.publishedAt),
      aggregation: aggregation ?? this.aggregation,
    })
  }
}

export function getLatestReportCard(results: ReportCardResult[]): ReportCardResult | undefined {
  if (results.length === 0)
    return undefined
  return [...results].sort((left, right) => {
    const leftDate = left.publishedAt ?? left.generatedAt
    const rightDate = right.publishedAt ?? right.generatedAt
    return rightDate.getTime() - leftDate.getTime() || left.id.localeCompare(right.id)
  })[0]
}
