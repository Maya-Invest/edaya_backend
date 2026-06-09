import type { AuthorizationPolicy } from '../../authorization'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../services/managed-entity-service'
import type { EntityConfigFactory } from '../../shared'
import type { AttendanceSummary } from '../../value_object/attendance-summary'
import type { ReportCardResultSection } from './report-card-result-section'
import { denyResourceAccess, Permission } from '../../authorization'
import { config, indirectTenant, permissionAction, read, readByIds, write } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { requireNonBlank, requireNonNegativeInt, requireNonNegativeNumber, requireOptionalNonBlank, roundTo2 } from '../utils'

export enum ReportCardResultStatus {
  Draft = 'draft',
  Published = 'published',
}

export interface ReportCardResultArgs {
  id: string
  reportCardDefinitionId: string
  studentId: string
  classGroupId: string
  periodId: string
  /** Root-level section results. Each may recursively contain subResults. */
  sectionResults: readonly ReportCardResultSection[]
  attendanceSummary: AttendanceSummary
  assessmentResultCount: number
  overallAverage?: number | null
  rank?: number | null
  classSize?: number | null
  passThreshold?: number | null
  teacherComment?: string | null
  principalComment?: string | null
  status?: ReportCardResultStatus
  generatedAt?: Date
  publishedAt?: Date
}

/**
 * Represents a student's official report card for a specific academic period.
 * Contains a hierarchical tree of section results (grouping and leaf) that
 * collectively describe the student's academic performance.
 */
export class ReportCardResult {
  readonly id: string
  readonly reportCardDefinitionId: string
  readonly studentId: string
  readonly classGroupId: string
  readonly periodId: string
  readonly sectionResults: readonly ReportCardResultSection[]
  readonly attendanceSummary: AttendanceSummary
  readonly assessmentResultCount: number
  readonly overallAverage?: number
  readonly rank?: number
  readonly classSize?: number
  readonly passThreshold?: number
  readonly teacherComment?: string
  readonly principalComment?: string
  readonly status: ReportCardResultStatus
  readonly generatedAt: Date
  readonly publishedAt?: Date

  constructor({
    id,
    reportCardDefinitionId,
    studentId,
    classGroupId,
    periodId,
    sectionResults,
    attendanceSummary,
    assessmentResultCount,
    overallAverage,
    rank,
    classSize,
    passThreshold,
    teacherComment,
    principalComment,
    status = ReportCardResultStatus.Draft,
    generatedAt,
    publishedAt,
  }: ReportCardResultArgs) {
    this.id = requireNonBlank(id, 'id')
    this.reportCardDefinitionId = requireNonBlank(reportCardDefinitionId, 'reportCardDefinitionId')
    this.studentId = requireNonBlank(studentId, 'studentId')
    this.classGroupId = requireNonBlank(classGroupId, 'classGroupId')
    this.periodId = requireNonBlank(periodId, 'periodId')
    this.sectionResults = Object.freeze([...sectionResults])
    this.attendanceSummary = attendanceSummary
    this.assessmentResultCount = requireNonNegativeInt(assessmentResultCount, 'assessmentResultCount')
    this.overallAverage
      = overallAverage == null ? undefined : roundTo2(requireNonNegativeNumber(overallAverage, 'overallAverage'))
    if (rank != null) {
      this.rank = requireNonNegativeInt(rank, 'rank')
    }
    if (classSize != null) {
      this.classSize = requireNonNegativeInt(classSize, 'classSize')
    }
    if (passThreshold != null) {
      this.passThreshold = roundTo2(requireNonNegativeNumber(passThreshold, 'passThreshold'))
    }
    this.teacherComment = requireOptionalNonBlank(teacherComment, 'teacherComment')
    this.principalComment = requireOptionalNonBlank(principalComment, 'principalComment')
    this.status = status
    this.generatedAt = generatedAt ?? new Date()
    this.publishedAt = publishedAt

    if (this.status === ReportCardResultStatus.Published && !this.publishedAt) {
      throw new Error('publishedAt is required for published report cards')
    }
    if (this.status === ReportCardResultStatus.Draft && this.publishedAt) {
      throw new Error('draft report cards must not define publishedAt')
    }
  }

  copyWith({ status, publishedAt }: { status?: ReportCardResultStatus, publishedAt?: Date }): ReportCardResult {
    return new ReportCardResult({
      id: this.id,
      reportCardDefinitionId: this.reportCardDefinitionId,
      studentId: this.studentId,
      classGroupId: this.classGroupId,
      periodId: this.periodId,
      sectionResults: this.sectionResults,
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
    read: read(permissionAction(policy, Permission.QUERY_REPORT_CARD_DETAIL_READ), readByIds((actor, ids) => policy.checkReportCardResultAccess(actor, ids))),
    write: write(permissionAction(policy, Permission.REPORT_CARD_PUBLISH), authorizeReportCardResult(policy), authorizeReportCardResultDelete(policy)),
    gates: {
      preSave: validateReportCardResultSave,
      preDelete: validateReportCardResultDelete,
    },
    atomicExecution,
  })

function reportCardResultTenant(): EntityTenantResolver<ReportCardResult> {
  return indirectTenant(async (entity, repositories) => {
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
