import type { ReportCardResultSection } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import { denyResourceAccess } from '@edaya/authorization'
import { describeGrade, TeacherAssignmentStatus } from '@edaya/core'
import { evaluationRankings, subjectStandings } from '../../capabilities/academics/live-rankings'
import { loadParticipation, subjectRoster } from '../../capabilities/subject-enrollment/participation'
import { buildSubjectAverageFromAssessments } from '../workflows/report-card-aggregation'
import { TeacherCorrectionsWorkflow } from '../workflows/teacher-corrections'

/** Exact teaching scope. Homeroom membership alone never admits this reader. */
export async function getTeacherSubjectPeriodSummary(base: BaseSchoolService, input: { classSubjectId: string, periodId: string }) {
  if (base.actor.kind !== 'teacher')
    denyResourceAccess()
  const offering = await base.entities.classSubjects.findById(input.classSubjectId)
  const period = await base.entities.academicPeriods.findById(input.periodId)
  if (!offering || !period)
    denyResourceAccess()
  const context = await base.access.assessmentEditor.context({ classGroupId: offering.classGroupId, periodId: period.id })
  const now = new Date()
  const assignments = await base.repositories.teacherAssignments.forSchool!(base.actor.schoolId).list({ teacherId: base.actor.teacherId, classSubjectId: offering.id, academicYearId: period.academicYearId, status: TeacherAssignmentStatus.Active })
  if (!assignments.some(row => row.kind === 'subject' && (!row.startsAt || row.startsAt <= now) && (!row.endsAt || row.endsAt > now)))
    denyResourceAccess()
  const marks = await base.access.assessmentEditor.marks()
  if (!marks)
    denyResourceAccess()
  const assessments = await marks.assessments.list({ classSubjectId: offering.id, periodId: period.id, marksStatus: 'submitted' })
  const results = assessments.length ? await marks.results.list({ assessmentId: { $in: assessments.map(row => row.id) } }) : []
  const byAssessment = new Map(assessments.map(row => [row.id, row]))
  const participation = await loadParticipation(base.repositories, [context.group.id])
  const ids = [...new Set([...subjectRoster(participation, offering.id, now), ...results.map(row => row.studentId)])]
  const students = await base.entities.students.findByIds(ids)
  const reports = await base.entities.results.list({ classGroupId: context.group.id, periodId: period.id })
  const byStudent = new Map(reports.map(row => [row.studentId, row]))
  const level = await base.repositories.gradeLevels.findById(context.group.gradeLevelId)
  const policy = level?.gradingPolicyFor(period.academicYearId)
  const ranks = evaluationRankings(assessments, results)
  const standings = subjectStandings(assessments, results, policy).get(offering.id)
  const ready = !policy || policy.status === 'completed'
  const findSection = (sections: readonly ReportCardResultSection[]): ReportCardResultSection | undefined => {
    for (const section of sections) {
      if (section.classSubjectId === offering.id)
        return section
      const child = findSection(section.subResults)
      if (child)
        return child
    }
    return undefined
  }
  return {
    classSubjectId: offering.id,
    classGroupId: context.group.id,
    periodId: period.id,
    calculationReady: ready,
    cohortComplete: students.length === ids.length,
    students: await Promise.all(students.sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)).map(async (student) => {
      const contributions = results.filter(row => row.studentId === student.id).map(result => ({ result, assessment: byAssessment.get(result.assessmentId)! }))
      const compatible = ready && contributions.every(({ result }) => !policy || !result.calculation || result.calculation.policyRevision === policy.revision)
      const average = compatible ? buildSubjectAverageFromAssessments(offering.id, contributions, policy) : undefined
      const report = byStudent.get(student.id)
      const section = report && findSection(report.sectionResults)
      const state = report?.status === 'published' && section
        ? await new TeacherCorrectionsWorkflow(base).getWorkflowState({ proposal: { workflow: 'report_comments', targetId: report.id, sections: [{ sectionId: section.sectionId, comment: section.comment ?? '' }] } })
        : undefined
      const active = state?.corrections.find(row => row.proposal.workflow === 'report_comments' && row.proposal.sections.some(change => change.sectionId === section?.sectionId))
      const proposal = active?.proposal.workflow === 'report_comments' ? active.proposal.sections.find(change => change.sectionId === section?.sectionId) : undefined
      const standing = standings?.get(student.id)
      return {
        ...(standing && average !== undefined ? { rank: standing.rank, participantCount: standing.participantCount } : {}),
        studentId: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        average: average ?? null,
        grading: average !== undefined && policy ? describeGrade(average, policy) : null,
        contributions: contributions.map(({ assessment, result }) => ({ ...ranks.get(result.id), assessmentId: assessment.id, title: assessment.title, coefficient: assessment.coefficient, maxScore: assessment.maxScore, score: result.score ?? null, designation: result.designation, grading: result.calculation ?? null })),
        comment: section && report ? { reportId: report.id, sectionId: section.sectionId, text: section.comment ?? '', status: report.status, version: report.version, calculationStale: report.calculationStale, proposal: proposal && active ? { text: proposal.comment ?? '', status: active.status } : null } : null,
      }
    })),
  }
}
