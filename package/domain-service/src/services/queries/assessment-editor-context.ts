import type { BaseSchoolService } from '../base-school-service'
import { assessmentDate } from '../../capabilities/academics/marks-state'
import { loadParticipation, subjectRoster } from '../../capabilities/subject-enrollment/participation'

/** Supporting data for one authorized assessment workspace, never a general directory grant. */
export async function getAssessmentEditorContext(base: BaseSchoolService, input: { classGroupId: string, periodId: string }) {
  const context = await base.access.assessmentEditor.context(input)
  const { group, period } = context
  const [assessments, classSubjects, enrollments] = await Promise.all([
    context.assessments.list({ classGroupId: group.id, periodId: period.id }),
    context.classSubjects.list({ classGroupId: group.id }),
    context.enrollments.list({ classGroupId: group.id }),
  ])
  const subjects = await context.subjects.findByIds([...new Set(classSubjects.map(row => row.subjectId))])
  const marks = await base.access.assessmentEditor.marks()
  const readableAssessments = marks ? await marks.assessments.findByIds(assessments.map(row => row.id)) : []
  const studentIds = [...new Set(enrollments.map(row => row.studentId))]
  const results = marks && readableAssessments.length && studentIds.length
    ? await marks.results.list({ assessmentId: { $in: readableAssessments.map(row => row.id) }, studentId: { $in: studentIds } })
    : []
  // An empty results collection means zero progress only for an explicitly readable assessment.
  const participation = await loadParticipation(base.repositories, [group.id])
  const rosterCounts = new Map(await Promise.all(assessments.map(async assessment => [assessment.id, assessment.marksStatus === 'draft' ? new Set([...subjectRoster(participation, assessment.classSubjectId, await assessmentDate(assessment, base.repositories)), ...results.filter(row => row.assessmentId === assessment.id).map(row => row.studentId)]).size : assessment.marksReview.rosterStudentIds.length] as const)))
  const markResults = readableAssessments.map(assessment => ({ assessmentId: assessment.id, rosterCount: rosterCounts.get(assessment.id) ?? 0, results: results.filter(row => row.assessmentId === assessment.id).map(row => row.data) }))
  return { assessmentsRaw: assessments.map(row => row.data), classSubjectsRaw: classSubjects.map(row => row.data), subjectsRaw: subjects.map(row => row.data), classSize: studentIds.length, markResults }
}
