import type { AttendanceSummary } from '../../value_object/attendance-summary'
import type { ReportCardResultSection } from './report-card-result-section'
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
