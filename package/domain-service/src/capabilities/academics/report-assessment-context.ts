import type { Assessment, AssessmentResult, StudentClassEnrollment } from '@edaya/core'
import type { AssessmentsWorkflowRepositories } from '../../services/runtime/workflow-repository-catalog'
import { loadInBatches } from '../shared/bounded-reads'
import { assessmentDate, enrollmentEffectiveAt } from './marks-state'

export interface ReportAssessmentContext {
  enrollments: StudentClassEnrollment[]
  assessments: Assessment[]
  results: Array<{ assessment: Assessment, result: AssessmentResult }>
  subjectByClassSubject: Map<string, string>
}

/** Fixed collection queries; never one assessment lookup per student mark. */
export async function loadReportAssessmentContext(
  repositories: AssessmentsWorkflowRepositories,
  schoolId: string,
  studentId: string,
  periodIds: readonly string[],
): Promise<ReportAssessmentContext> {
  const enrollments = await repositories.enrollments.list({ studentId })
  const ids = await repositories.assessmentDependencies.reportAssessmentIds(schoolId, studentId, periodIds)
  const candidates = await loadInBatches(ids, batch => repositories.assessments.findByIds(batch))
  const sessionIds = [...new Set(candidates.flatMap(row => row.lessonSessionId ? [row.lessonSessionId] : []))]
  const sessions = new Map((await loadInBatches(sessionIds, batch => repositories.lessonSessions.findByIds(batch))).map(row => [row.id, row]))
  const assessments: Assessment[] = []
  for (const assessment of candidates) {
    if (assessment.marksStatus !== 'draft') {
      if (assessment.marksReview.rosterStudentIds.includes(studentId))
        assessments.push(assessment)
      continue
    }
    const at = await assessmentDate(assessment, { lessonSessions: { findById: async id => sessions.get(id) } })
    if (enrollments.some(row => row.classGroupId === assessment.classGroupId && enrollmentEffectiveAt(row, at)))
      assessments.push(assessment)
  }
  const approved = new Map(assessments.filter(row => row.marksStatus === 'approved' && row.marksReview.rosterStudentIds.includes(studentId)).map(row => [row.id, row]))
  const subjects = await loadInBatches(assessments.map(row => row.classSubjectId), batch => repositories.classSubjects.findByIds(batch))
  const marks = await loadInBatches([...approved.keys()], batch => repositories.assessmentResults.list({ studentId, assessmentId: { $in: batch } }))
  return {
    enrollments,
    assessments,
    results: marks.filter(result => approved.has(result.assessmentId)).map(result => ({ result, assessment: approved.get(result.assessmentId)! })),
    subjectByClassSubject: new Map(subjects.map(row => [row.id, row.subjectId])),
  }
}
