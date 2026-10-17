import type { BaseSchoolService } from '../base-school-service'
import { StudentClassEnrollmentStatus } from '@edaya/core'

/** Supporting data for one authorized assessment workspace, never a general directory grant. */
export async function getAssessmentEditorContext(base: BaseSchoolService, input: { classGroupId: string, periodId: string }) {
  const context = await base.access.assessmentEditor.context(input)
  const { group, period } = context
  const [assessments, classSubjects, enrollments] = await Promise.all([
    context.assessments.list({ classGroupId: group.id, periodId: period.id }),
    context.classSubjects.list({ classGroupId: group.id }),
    context.enrollments.list({ classGroupId: group.id, status: StudentClassEnrollmentStatus.Active }),
  ])
  const subjects = await context.subjects.findByIds([...new Set(classSubjects.map(row => row.subjectId))])
  const marks = await base.access.assessmentEditor.marks()
  const readableAssessments = marks ? await marks.assessments.findByIds(assessments.map(row => row.id)) : []
  const studentIds = [...new Set(enrollments.map(row => row.studentId))]
  const results = marks && readableAssessments.length && studentIds.length
    ? await marks.results.list({ assessmentId: { $in: readableAssessments.map(row => row.id) }, studentId: { $in: studentIds } })
    : []
  // An empty results collection means zero progress only for an explicitly readable assessment.
  const markResults = readableAssessments.map(assessment => ({ assessmentId: assessment.id, results: results.filter(row => row.assessmentId === assessment.id).map(row => row.data) }))
  return { assessmentsRaw: assessments.map(row => row.data), classSubjectsRaw: classSubjects.map(row => row.data), subjectsRaw: subjects.map(row => row.data), classSize: studentIds.length, markResults }
}
