import type { AuthorizationPolicy } from '../../authorization'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../services/managed-entity-service'
import type { EntityConfigFactory } from '../../shared'
import type { ReportCardResultSection } from './report-card-result-section'
import { z } from 'zod'
import { denyResourceAccess, Permission } from '../../authorization'
import { config, indirectTenant, permissionAction, read, readByIds, write } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { AttendanceSummary, attendanceSummarySchema } from '../../value_object/attendance-summary'
import { parseDomain, roundTo2, zodDate } from '../utils'
import { reportCardResultSectionSchema } from './report-card-result-section'

export enum ReportCardResultStatus {
  Draft = 'draft',
  Published = 'published',
}

export const reportCardResultBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  reportCardDefinitionId: z.string().trim().min(1, 'reportCardDefinitionId must not be blank'),
  studentId: z.string().trim().min(1, 'studentId must not be blank'),
  classGroupId: z.string().trim().min(1, 'classGroupId must not be blank'),
  periodId: z.string().trim().min(1, 'periodId must not be blank'),
  attendanceSummary: attendanceSummarySchema.transform(data => new AttendanceSummary(data)),
  assessmentResultCount: z.number().int().nonnegative('assessmentResultCount must be a non-negative integer'),
  overallAverage: z.number().finite().nonnegative('overallAverage must be a finite, non-negative number').transform(v => roundTo2(v)).nullable().optional().transform(v => v === null ? undefined : v),
  rank: z.number().int().nonnegative('rank must be a non-negative integer').nullable().optional().transform(v => v === null ? undefined : v),
  classSize: z.number().int().nonnegative('classSize must be a non-negative integer').nullable().optional().transform(v => v === null ? undefined : v),
  passThreshold: z.number().finite().nonnegative('passThreshold must be a finite, non-negative number').transform(v => roundTo2(v)).nullable().optional().transform(v => v === null ? undefined : v),
  teacherComment: z.string().trim().min(1, 'teacherComment must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  principalComment: z.string().trim().min(1, 'principalComment must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  status: z.nativeEnum(ReportCardResultStatus).default(ReportCardResultStatus.Draft),
  generatedAt: zodDate().default(() => new Date()),
  publishedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
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

export const reportCardResultSchema = reportCardResultBaseSchema.extend({
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
    this.data = parseDomain(reportCardResultSchema, args) as any
    this.sectionResults = Object.freeze([...args.sectionResults])
  }

  get id() { return this.data.id }
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
  get teacherComment() { return this.data.teacherComment }
  get principalComment() { return this.data.principalComment }
  get status() { return this.data.status }
  get generatedAt() { return this.data.generatedAt }
  get publishedAt() { return this.data.publishedAt }

  copyWith({ status, publishedAt }: { status?: ReportCardResultStatus, publishedAt?: Date }): ReportCardResult {
    return new ReportCardResult({
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
      generatedAt: this.generatedAt,
      publishedAt: publishedAt ?? this.publishedAt,
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

export const reportCardResultConfig: EntityConfigFactory<ReportCardResult> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.results,
    tenant: reportCardResultTenant(),
    read: read(permissionAction(Permission.QUERY_REPORT_CARD_DETAIL_READ), readByIds((actor: any, ids: readonly string[]) => policy.checkReportCardResultAccess(actor, ids))),
    write: write(permissionAction(Permission.REPORT_CARD_PUBLISH), authorizeReportCardResult(policy), authorizeReportCardResultDelete(policy)),
    gates: {
      preSave: validateReportCardResultSave,
      preDelete: validateReportCardResultDelete,
    },
    atomicExecution,
  })

function reportCardResultTenant(): EntityTenantResolver<ReportCardResult> {
  return indirectTenant(async (entity: ReportCardResult, repositories: SchoolRepositories) => {
    const student = await repositories.students.findById(entity.studentId)
    return student?.schoolId
  })
}

async function validateReportCardResultSave(
  result: ReportCardResult,
  _existing: ReportCardResult | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const [student, classGroup, period, definition] = await Promise.all([
    repositories.students.findById(result.studentId),
    repositories.classGroups.findById(result.classGroupId),
    repositories.academicPeriods.findById(result.periodId),
    repositories.definitions.findById(result.reportCardDefinitionId),
  ])
  if (
    !student
    || !classGroup
    || student.schoolId !== classGroup.schoolId
    || !period
    || period.schoolId !== student.schoolId
    || period.academicYearId !== classGroup.academicYearId
    || !definition
    || definition.schoolId !== student.schoolId
    || definition.academicYearId !== period.academicYearId
  ) {
    denyResourceAccess()
  }

  const published = await repositories.results.findOne({
    studentId: result.studentId,
    periodId: result.periodId,
    status: ReportCardResultStatus.Published,
  })
  if (!published || published.status !== ReportCardResultStatus.Published) {
    return
  }
  throw new BusinessRuleViolationError('PUBLISHED_REPORT_CARD_IMMUTABLE', `Published report card for student ${result.studentId} and period ${result.periodId} is immutable`)
}

function authorizeReportCardResult(policy: AuthorizationPolicy): EntityWriteAuthorization<ReportCardResult>['authorizeSave'] {
  return async (actor, entity, existing) => {
    await policy.checkStudentAccess(actor, [entity.studentId])
    if (existing)
      await policy.checkReportCardResultAccess(actor, [existing.id])
  }
}

function authorizeReportCardResultDelete(policy: AuthorizationPolicy): EntityWriteAuthorization<ReportCardResult>['authorizeDelete'] {
  return async (actor, entity) => {
    await policy.checkReportCardResultAccess(actor, [entity.id])
  }
}

async function validateReportCardResultDelete(
  result: ReportCardResult,
): Promise<void> {
  if (result.status === ReportCardResultStatus.Published) {
    throw new BusinessRuleViolationError('PUBLISHED_REPORT_CARD_IMMUTABLE', `Published report card for student ${result.studentId} and period ${result.periodId} is immutable`)
  }
}
