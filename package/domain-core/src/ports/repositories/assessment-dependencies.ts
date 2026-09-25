/** Read/write projections for report provenance. Callers must hold the academic-state lock for mutations. */
export interface AssessmentDependenciesPort {
  reportAssessmentIds: (schoolId: string, studentId: string, periodIds: readonly string[]) => Promise<string[]>
  publishedAssessmentIds: (schoolId: string, assessmentIds: readonly string[]) => Promise<Set<string>>
  invalidateDrafts: (input: { schoolId: string, assessmentId: string, periodId: string, classGroupId: string }) => Promise<void>
}
