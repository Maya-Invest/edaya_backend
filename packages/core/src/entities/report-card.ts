import type { ModuleResult } from '$lib/core/entities/module-result'
import type { AttendanceSummary } from '$lib/core/value_object/attendance-summary'
import { requireNonBlank, requireNonNegativeInt, requireNonNegativeNumber, requireOptionalNonBlank, roundTo2 } from '$lib/core/validation'

export enum ReportCardStatus {
  Draft = 'draft',
  Published = 'published',
}

export interface ReportCardArgs {
  id: string
  studentId: string
  classroomId: string
  periodId: string
  /** Root-level module results. Each may recursively contain subResults. */
  moduleResults: readonly ModuleResult[]
  attendanceSummary: AttendanceSummary
  gradeCount: number
  overallAverage?: number | null
  rank?: number | null
  classSize?: number | null
  passThreshold?: number | null
  teacherComment?: string | null
  principalComment?: string | null
  status?: ReportCardStatus
  generatedAt?: Date
  publishedAt?: Date
}

/**
 * Represents a student's official report card for a specific academic period.
 * Contains a hierarchical tree of ModuleResult nodes (grouping and leaf) that
 * collectively describe the student's academic performance.
 */
export class ReportCard {
  readonly id: string
  readonly studentId: string
  readonly classroomId: string
  readonly periodId: string
  readonly moduleResults: readonly ModuleResult[]
  readonly attendanceSummary: AttendanceSummary
  readonly gradeCount: number
  readonly overallAverage?: number
  readonly rank?: number
  readonly classSize?: number
  readonly passThreshold?: number
  readonly teacherComment?: string
  readonly principalComment?: string
  readonly status: ReportCardStatus
  readonly generatedAt: Date
  readonly publishedAt?: Date

  constructor({
    id,
    studentId,
    classroomId,
    periodId,
    moduleResults,
    attendanceSummary,
    gradeCount,
    overallAverage,
    rank,
    classSize,
    passThreshold,
    teacherComment,
    principalComment,
    status = ReportCardStatus.Draft,
    generatedAt,
    publishedAt,
  }: ReportCardArgs) {
    this.id = requireNonBlank(id, 'id')
    this.studentId = requireNonBlank(studentId, 'studentId')
    this.classroomId = requireNonBlank(classroomId, 'classroomId')
    this.periodId = requireNonBlank(periodId, 'periodId')
    this.moduleResults = Object.freeze([...moduleResults])
    this.attendanceSummary = attendanceSummary
    this.gradeCount = requireNonNegativeInt(gradeCount, 'gradeCount')
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

    if (this.status === ReportCardStatus.Published && !this.publishedAt) {
      throw new Error('publishedAt is required for published report cards')
    }
    if (this.status === ReportCardStatus.Draft && this.publishedAt) {
      throw new Error('draft report cards must not define publishedAt')
    }
  }

  copyWith({ status, publishedAt }: { status?: ReportCardStatus, publishedAt?: Date }): ReportCard {
    return new ReportCard({
      id: this.id,
      studentId: this.studentId,
      classroomId: this.classroomId,
      periodId: this.periodId,
      moduleResults: this.moduleResults,
      attendanceSummary: this.attendanceSummary,
      gradeCount: this.gradeCount,
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
