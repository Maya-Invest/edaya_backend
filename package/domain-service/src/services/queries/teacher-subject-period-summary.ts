import type { BaseSchoolService } from '../base-school-service'
import { denyResourceAccess } from '@edaya/authorization'
import { describeGrade } from '@edaya/core'
import { evaluationRankings, subjectStandings } from '../../capabilities/academics/live-rankings'
import { groupByKey } from '../../capabilities/shared/bounded-reads'
import { loadParticipation, subjectRoster } from '../../capabilities/subject-enrollment/participation'
import { buildSubjectAverageFromAssessments } from '../workflows/report-card-aggregation'
import { gradebookComments } from './teacher-gradebook-comments'

/** Exact teaching scope. Homeroom membership alone never admits this reader. */
export async function getTeacherSubjectPeriodSummary(base: BaseSchoolService, input: { classSubjectId: string, periodId: string }) {
  if (base.actor.kind !== 'teacher')
    denyResourceAccess()
  const access = base.access.forOperation()
  const offering = await base.entities.classSubjects.findById(input.classSubjectId, access)
  const period = await base.entities.academicPeriods.findById(input.periodId, access)
  if (!offering || !period)
    denyResourceAccess()
  const context = await access.assessmentEditor.context({ classGroupId: offering.classGroupId, periodId: period.id })
  const now = new Date()
  const teaching = await access.teacherReportCommentTargets(context.group.id)
  if (teaching.year !== period.academicYearId || !teaching.subjects.has(offering.id))
    denyResourceAccess()
  const marks = await access.assessmentEditor.marks()
  if (!marks)
    denyResourceAccess()
  const assessments = await marks.assessments.list({ classSubjectId: offering.id, periodId: period.id, marksStatus: 'submitted' })
  const results = assessments.length ? await marks.results.list({ assessmentId: { $in: assessments.map(row => row.id) } }) : []
  const byAssessment = new Map(assessments.map(row => [row.id, row]))
  const participation = await loadParticipation(base.repositories, [context.group.id])
  const ids = [...new Set([...subjectRoster(participation, offering.id, now), ...results.map(row => row.studentId)])]
  const students = await base.entities.students.findByIds(ids, access)
  const comments = await gradebookComments(base, access, teaching, { ...input, classGroupId: context.group.id }, students.map(student => student.id))
  const byStudent = groupByKey(results, row => row.studentId)
  const level = await base.repositories.gradeLevels.findById(context.group.gradeLevelId)
  const policy = level?.gradingPolicyFor(period.academicYearId)
  const ranks = evaluationRankings(assessments, results)
  const standings = subjectStandings(assessments, results, policy).get(offering.id)
  const ready = !policy || policy.status === 'completed'
  return {
    classSubjectId: offering.id,
    classGroupId: context.group.id,
    periodId: period.id,
    calculationReady: ready,
    cohortComplete: students.length === ids.length,
    students: students.sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)).map((student) => {
      const contributions = (byStudent.get(student.id) ?? []).map(result => ({ result, assessment: byAssessment.get(result.assessmentId)! }))
      const compatible = ready && contributions.every(({ result }) => !policy || !result.calculation || result.calculation.policyRevision === policy.revision)
      const average = compatible ? buildSubjectAverageFromAssessments(offering.id, contributions, policy) : undefined
      const standing = standings?.get(student.id)
      return {
        ...(standing && average !== undefined ? { rank: standing.rank, participantCount: standing.participantCount } : {}),
        studentId: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        average: average ?? null,
        grading: average !== undefined && policy ? describeGrade(average, policy) : null,
        contributions: contributions.map(({ assessment, result }) => ({ ...ranks.get(result.id), assessmentId: assessment.id, title: assessment.title, coefficient: assessment.coefficient, maxScore: assessment.maxScore, score: result.score ?? null, designation: result.designation, grading: result.calculation ?? null })),
        comment: comments.get(student.id) ?? null,
      }
    }),
  }
}
