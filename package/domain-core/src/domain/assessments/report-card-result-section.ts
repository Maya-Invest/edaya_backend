import { z } from 'zod'
import { parseDomain, roundTo2 } from '../shared/utils'
import { ReportCardDefinitionSectionKind } from './report-card-definition-section'

export const reportCardResultSectionBaseSchema = z.object({
  sectionId: z.string().trim().min(1, 'sectionId must not be blank'),
  sectionKind: z.nativeEnum(ReportCardDefinitionSectionKind),
  name: z.string().trim().min(1, 'name must not be blank'),
  average: z.number().finite().nonnegative('average must be a finite, non-negative number').transform(v => roundTo2(v)),
  weight: z.number().finite().nonnegative('weight must be a finite, non-negative number'),
  parentSectionId: z.string().trim().min(1, 'parentSectionId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  classSubjectId: z.string().trim().min(1, 'classSubjectId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  comment: z.string().trim().min(1, 'comment must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
})

function refineReportCardResultSection(data: any, ctx: z.RefinementCtx) {
  if (data.sectionKind === ReportCardDefinitionSectionKind.Group && data.classSubjectId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'group section results must not reference a class subject',
    })
  }
  if (data.sectionKind === ReportCardDefinitionSectionKind.Subject && !data.classSubjectId) {
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
    this.data = parseDomain(reportCardResultSectionSchema, args)
    this.subResults = Object.freeze(args.subResults ? [...args.subResults] : [])
  }

  get sectionId() { return this.data.sectionId }
  get sectionKind() { return this.data.sectionKind }
  get name() { return this.data.name }
  get average() { return this.data.average }
  get weight() { return this.data.weight }
  get parentSectionId() { return this.data.parentSectionId }
  get classSubjectId() { return this.data.classSubjectId }
  get comment() { return this.data.comment }
}
