import type { BaseSchoolService } from '../base-school-service'
import { denyResourceAccess } from '@edaya/authorization'
import { assessmentDate, assessmentRoster, enrollmentEffectiveAt } from '../../capabilities/academics/marks-state'
import { pickWorkflowRepositories } from '../runtime/workflow-repository-catalog'

export interface MarksQueueInput {
  status?: 'draft' | 'submitted' | 'approved'
  classGroupId?: string
  periodId?: string
  offset?: number
  limit?: number
}

export async function listAssessmentMarksReviews(base: BaseSchoolService, input: MarksQueueInput) {
  if (base.actor.kind !== 'staff')
    denyResourceAccess()
  const repositories = pickWorkflowRepositories('assessments', base.repositories)
  const scoped = repositories.assessments.forAccess(await base.access.marksReview.queueScope())
  const filter = { marksStatus: input.status ?? 'submitted', ...(input.classGroupId ? { classGroupId: input.classGroupId } : {}), ...(input.periodId ? { periodId: input.periodId } : {}) }
  const offset = Math.max(0, input.offset ?? 0)
  const limit = Math.min(100, Math.max(1, input.limit ?? 25))
  const [rows, total] = await Promise.all([scoped.list({ ...filter, $offset: offset, $limit: limit, $orderBy: [{ field: 'id', direction: 'asc' }] }), scoped.count(filter)])
  const draftRows = rows.filter(row => row.marksStatus === 'draft')
  const [marks, enrollments, sessions, published] = await Promise.all([
    rows.length ? repositories.assessmentResults.list({ assessmentId: { $in: rows.map(row => row.id) } }) : Promise.resolve([]),
    draftRows.length ? repositories.enrollments.list({ classGroupId: { $in: [...new Set(draftRows.map(row => row.classGroupId))] } }) : Promise.resolve([]),
    repositories.lessonSessions.findByIds(draftRows.flatMap(row => row.lessonSessionId ? [row.lessonSessionId] : [])),
    repositories.assessmentDependencies.publishedAssessmentIds(base.actor.schoolId, rows.map(row => row.id)),
  ])
  const sessionById = new Map(sessions.map(row => [row.id, row]))
  const completedByAssessment = new Map<string, Set<string>>()
  for (const mark of marks) {
    if (mark.score === undefined && mark.designation !== 'absent' && mark.designation !== 'exempt')
      continue
    const set = completedByAssessment.get(mark.assessmentId) ?? new Set<string>()
    set.add(mark.studentId)
    completedByAssessment.set(mark.assessmentId, set)
  }
  const permissions = new Map<string, Promise<boolean>>()
  const permitted = (classGroupId: string, action: 'submit' | 'returnSubmitted' | 'returnApproved') => {
    const key = `${classGroupId}:${action}`
    if (!permissions.has(key))
      permissions.set(key, base.access.marksReview.can(action, { classGroupId }))
    return permissions.get(key)!
  }
  const items = []
  for (const row of rows) {
    let roster = row.marksReview.rosterStudentIds
    if (row.marksStatus === 'draft') {
      const at = await assessmentDate(row, { lessonSessions: { findById: async id => sessionById.get(id) } })
      roster = [...new Set(enrollments.filter(enrollment => enrollment.classGroupId === row.classGroupId && enrollmentEffectiveAt(enrollment, at)).map(enrollment => enrollment.studentId))]
    }
    const completed = roster.filter(id => completedByAssessment.get(row.id)?.has(id)).length
    const independent = row.marksReview.submittedBy !== base.actor.subjectId && !row.marksReview.editedBySubjectIds.includes(base.actor.subjectId)
    items.push({ ...row.data, completeness: { eligible: roster.length, completed, missing: roster.length - completed }, allowedActions: {
      submit: row.marksStatus === 'draft' && roster.length > 0 && completed === roster.length && await permitted(row.classGroupId, 'submit'),
      approve: row.marksStatus === 'submitted' && independent,
      return: row.marksStatus !== 'draft' && !published.has(row.id) && await permitted(row.classGroupId, row.marksStatus === 'approved' ? 'returnApproved' : 'returnSubmitted'),
    } })
  }
  return { items, total, offset, limit }
}

export async function getAssessmentMarksReview(base: BaseSchoolService, input: { assessmentId: string }) {
  if (base.actor.kind !== 'staff' && base.actor.kind !== 'teacher')
    denyResourceAccess()
  const repositories = pickWorkflowRepositories('assessments', base.repositories)
  const scope = await base.access.marksReview.detail(input.assessmentId)
  const assessment = await repositories.assessments.forAccess(scope).findById(input.assessmentId)
  if (!assessment)
    denyResourceAccess()
  const roster = assessment.marksStatus === 'draft' ? await assessmentRoster(assessment, repositories) : assessment.marksReview.rosterStudentIds
  const results = await repositories.assessmentResults.list({ assessmentId: assessment.id })
  const students = await repositories.students.findByIds(roster)
  const byStudent = new Map(results.map(result => [result.studentId, result]))
  const missingStudentIds = roster.filter((id) => {
    const result = byStudent.get(id)
    return !result || (result.score === undefined && result.designation !== 'absent' && result.designation !== 'exempt')
  })
  const independent = assessment.marksReview.submittedBy !== base.actor.subjectId && !assessment.marksReview.editedBySubjectIds.includes(base.actor.subjectId)
  const published = await repositories.assessmentDependencies.publishedAssessmentIds(base.actor.schoolId, [assessment.id])
  const hasPublishedDependents = published.has(assessment.id)
  return {
    assessment: assessment.data,
    students: students.map(student => ({ id: student.id, firstName: student.firstName, lastName: student.lastName })),
    results: results.map(result => result.data),
    missingStudentIds,
    allowedActions: {
      submit: assessment.marksStatus === 'draft' && roster.length > 0 && !missingStudentIds.length && await base.access.marksReview.can('submit', assessment),
      approve: base.actor.kind === 'staff' && assessment.marksStatus === 'submitted' && independent && await base.access.marksReview.can('approve', assessment),
      return: base.actor.kind === 'staff' && assessment.marksStatus !== 'draft' && !hasPublishedDependents && await base.access.marksReview.can(assessment.marksStatus === 'approved' ? 'returnApproved' : 'returnSubmitted', assessment),
    },
  }
}
