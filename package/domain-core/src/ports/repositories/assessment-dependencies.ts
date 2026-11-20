import type { ResourceAccessScope } from './resource-access-scope'

/** Read/write projections for report provenance. Callers must hold the academic-state lock for mutations. */
export interface AssessmentDependenciesPort {
  pendingGradingClass: (input: { schoolId: string, gradeLevelId: string, academicYearId: string, policyRevision: number }) => Promise<string | undefined>
  refreshGradingRankings: (input: { schoolId: string, classGroupId: string, policyRevision: number }) => Promise<void>
  publishedMarkIds: (schoolId: string, resultIds: readonly string[]) => Promise<Set<string>>
  invalidateMarkDrafts: (schoolId: string, resultIds: readonly string[]) => Promise<void>
  guardianSubjectMarks: (scope: ResourceAccessScope, input: {
    schoolId: string
    studentId: string
    academicYearId: string
    gradeLevelId: string
    periodIds: readonly string[]
    subjectId?: string
    classSubjectId?: string
    after?: { date: string | null, id: string }
    markId?: string
    limit: number
  }) => Promise<Array<{ id: string, assessmentId: string, subjectId: string }>>
  reportAssessmentIds: (schoolId: string, studentId: string, periodIds: readonly string[]) => Promise<string[]>
  publishedAssessmentIds: (schoolId: string, assessmentIds: readonly string[]) => Promise<Set<string>>
  invalidateDrafts: (input: { schoolId: string, assessmentId: string, periodId: string, classGroupId: string }) => Promise<void>
}
