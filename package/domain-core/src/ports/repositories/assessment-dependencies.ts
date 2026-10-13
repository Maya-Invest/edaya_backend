/** Read/write projections for report provenance. Callers must hold the academic-state lock for mutations. */
export interface AssessmentDependenciesPort {
  pendingGradingClass: (input: { schoolId: string, gradeLevelId: string, academicYearId: string, policyRevision: number }) => Promise<string | undefined>
  refreshGradingRankings: (input: { schoolId: string, classGroupId: string, policyRevision: number }) => Promise<void>
  publishedMarkIds: (schoolId: string, resultIds: readonly string[]) => Promise<Set<string>>
  invalidateMarkDrafts: (schoolId: string, resultIds: readonly string[]) => Promise<void>
  reportAssessmentIds: (schoolId: string, studentId: string, periodIds: readonly string[]) => Promise<string[]>
  publishedAssessmentIds: (schoolId: string, assessmentIds: readonly string[]) => Promise<Set<string>>
  invalidateDrafts: (input: { schoolId: string, assessmentId: string, periodId: string, classGroupId: string }) => Promise<void>
}
