import { z } from 'zod'

import { calculatedGradeSchema } from '../school/grading-policy'

import { parseDomain, roundTo2 } from '../shared/utils'

import { reportModuleWeightingModeSchema } from './report-module'

export enum ReportCardResultSectionKind {
  Module = 'module',
  Subject = 'subject',
}

export const reportCardResultSectionBaseSchema = z.object({
  sectionId: z.string().trim().min(1, 'sectionId must not be blank'),
  sectionKind: z.nativeEnum(ReportCardResultSectionKind),
  subjectId: z.string().min(1).optional(),
  moduleId: z.string().min(1).optional(),
  coefficient: z.number().finite().positive().optional(),
  weightingMode: reportModuleWeightingModeSchema.optional(),
  explicitWeight: z.number().finite().positive().optional(),
  contributingCoefficientSum: z.number().finite().nonnegative().optional(),
  order: z.number().int().nonnegative().default(0),
  name: z.string().trim().min(1, 'name must not be blank'),
  grading: calculatedGradeSchema.optional(),
  average: z.number().finite().nonnegative('average must be a finite, non-negative number').optional(),
  weight: z.number().finite().nonnegative('weight must be a finite, non-negative number'),
  parentSectionId: z.string().trim().min(1, 'parentSectionId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  classSubjectId: z.string().trim().min(1, 'classSubjectId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  comment: z.string().trim().min(1, 'comment must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  participantCount: z.number().int().positive().nullable().optional().transform(v => v === null ? undefined : v),
  rank: z.number().int().nonnegative('rank must be a non-negative integer').nullable().optional().transform(v => v === null ? undefined : v),
})

function refineReportCardResultSection(data: any, ctx: z.RefinementCtx) {
  if ((data.sectionKind === ReportCardResultSectionKind.Subject && data.subResults.length) || data.subResults.some((child: any) => child.sectionKind !== ReportCardResultSectionKind.Subject))
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['subResults'], message: 'Report modules may contain subject results only' })
  if (data.sectionKind === ReportCardResultSectionKind.Module && data.classSubjectId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'group section results must not reference a class subject',
    })
  }
  if (data.sectionKind === ReportCardResultSectionKind.Subject && !data.classSubjectId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'subject section results must reference a class subject',
    })
  }
}

export const reportCardResultSectionSchema: z.ZodType<any> = reportCardResultSectionBaseSchema.extend({
  subResults: z.lazy(() => reportCardResultSectionSchema.array()).default([]),
}).superRefine(refineReportCardResultSection)

export type ReportCardResultSectionData = z.infer<typeof reportCardResultSectionSchema>
export type ReportCardResultSectionInput = z.input<typeof reportCardResultSectionSchema>

/**
 * Represents the computed result for one report-card section.
 * Group sections derive their average from child results; subject sections derive it from assessment results.
 */
export class ReportCardResultSection {
  readonly data: any
  readonly subResults: readonly ReportCardResultSection[]

  constructor(args: ReportCardResultSectionInput) {
    this.data = parseDomain(reportCardResultSectionSchema, { ...args, average: args.grading || args.average === undefined ? args.average : roundTo2(args.average) })
    this.subResults = Object.freeze(args.subResults ? [...args.subResults] : [])
  }

  get subjectId() { return this.data.subjectId as string | undefined }
  get moduleId() { return this.data.moduleId as string | undefined }
  get coefficient() { return this.data.coefficient as number | undefined }
  get weightingMode() { return this.data.weightingMode }
  get explicitWeight() { return this.data.explicitWeight as number | undefined }
  get contributingCoefficientSum() { return this.data.contributingCoefficientSum as number | undefined }
  get order() { return this.data.order as number }
  get grading() { return this.data.grading as import('../school/grading-policy').CalculatedGrade | undefined }
  get sectionId() { return this.data.sectionId }
  get sectionKind() { return this.data.sectionKind }
  get name() { return this.data.name }
  get average() { return this.data.average }
  get weight() { return this.data.weight }
  get parentSectionId() { return this.data.parentSectionId }
  get classSubjectId() { return this.data.classSubjectId }
  get comment() { return this.data.comment }
  get participantCount() { return this.data.participantCount as number | undefined }
  get rank() { return this.data.rank }
}
