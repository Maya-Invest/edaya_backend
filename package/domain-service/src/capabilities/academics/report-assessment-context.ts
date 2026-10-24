import type { Assessment, AssessmentResult, ClassSubject, StudentClassEnrollment, StudentSubjectEnrollment } from '@edaya/core'
import type { AssessmentsWorkflowRepositories } from '../../services/runtime/workflow-repository-catalog'
import { loadInBatches } from '../shared/bounded-reads'
import { schoolDayStart } from '../subject-enrollment/dates'
import { enrolledDuring, subjectRoster } from '../subject-enrollment/participation'
import { assessmentDate } from './marks-state'

export interface ReportAssessmentContext {
  enrollments: StudentClassEnrollment[]
  participation: StudentSubjectEnrollment[]
  classSubjects: ClassSubject[]
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
  const participation = await loadInBatches(enrollments.map(row => row.id), batch => repositories.subjectEnrollments.list({ studentClassEnrollmentId: { $in: batch } }))
  const periods = await repositories.academicPeriods.findByIds([...periodIds])
  const school = await repositories.schools.findById(schoolId)
  const ranges = periods.map(period => [schoolDayStart(period.startDate, school?.timeZone ?? 'UTC'), schoolDayStart(period.endDate, school?.timeZone ?? 'UTC', 1)] as const)
  const relevantParticipation = participation.filter(row => ranges.some(([start, end]) => enrolledDuring(row, start, end)))
  const participationContext = { placements: new Map(enrollments.map(row => [row.id, row])), enrollments: participation }
  const ids = await repositories.assessmentDependencies.reportAssessmentIds(schoolId, studentId, periodIds)
  const candidates = await loadInBatches(ids, batch => repositories.assessments.findByIds(batch))
  const sessionIds = [...new Set(candidates.flatMap(row => row.lessonSessionId ? [row.lessonSessionId] : []))]
  const sessions = new Map((await loadInBatches(sessionIds, batch => repositories.lessonSessions.findByIds(batch))).map(row => [row.id, row]))
  const savedMarks = await loadInBatches(candidates.map(row => row.id), ids => repositories.assessmentResults.list({ studentId, assessmentId: { $in: ids } }))
  const markedIds = new Set(savedMarks.map(row => row.assessmentId))
  const contributingIds = new Set(savedMarks.filter(row => row.designation !== 'absent' && row.designation !== 'exempt' && (row.score !== undefined || row.mentionId !== undefined || row.data.originalEntry)).map(row => row.assessmentId))
  const retainedOfferingIds = candidates.filter(row => contributingIds.has(row.id)).map(row => row.classSubjectId)
  const classSubjects = await loadInBatches([...new Set([...relevantParticipation.map(row => row.classSubjectId), ...retainedOfferingIds])], ids => repositories.classSubjects.findByIds(ids))
  const assessments: Assessment[] = []
  for (const assessment of candidates) {
    if (assessment.marksStatus !== 'draft') {
      if (assessment.marksReview.rosterStudentIds.includes(studentId))
        assessments.push(assessment)
      continue
    }
    const at = await assessmentDate(assessment, { lessonSessions: { findById: async id => sessions.get(id) } })
    if (markedIds.has(assessment.id) || subjectRoster(participationContext, assessment.classSubjectId, at).includes(studentId))
      assessments.push(assessment)
  }
  const approved = new Map(assessments.filter(row => row.marksStatus === 'submitted' && row.marksReview.rosterStudentIds.includes(studentId)).map(row => [row.id, row]))
  const subjects = await loadInBatches(assessments.map(row => row.classSubjectId), batch => repositories.classSubjects.findByIds(batch))
  const marks = await loadInBatches([...approved.keys()], batch => repositories.assessmentResults.list({ studentId, assessmentId: { $in: batch } }))
  return {
    enrollments,
    participation: relevantParticipation,
    classSubjects,
    assessments,
    results: marks.filter(result => approved.has(result.assessmentId)).map(result => ({ result, assessment: approved.get(result.assessmentId)! })),
    subjectByClassSubject: new Map(subjects.map(row => [row.id, row.subjectId])),
  }
}

/** Only curriculum subjects offered by the destination class and present in the report contribute sources. */
export async function scopeReportAssessmentContext(
  repositories: AssessmentsWorkflowRepositories,
  context: ReportAssessmentContext,
  definitionId: string,
  _classGroupId: string,
): Promise<ReportAssessmentContext> {
  const sections = await repositories.sections.list({ reportCardDefinitionId: definitionId })
  const offered = new Set(context.classSubjects.map(row => row.subjectId))
  const subjects = new Set(sections.filter(row => row.kind === 'subject' && row.subjectId && offered.has(row.subjectId)).map(row => row.subjectId))
  const includes = (assessment: Assessment) => subjects.has(context.subjectByClassSubject.get(assessment.classSubjectId))
  return { ...context, assessments: context.assessments.filter(includes), results: context.results.filter(row => includes(row.assessment)) }
}
