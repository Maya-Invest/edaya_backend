import type { MarksCorrection } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import { denyResourceAccess } from '@edaya/authorization'
import { assessmentRoster } from '../../capabilities/academics/marks-state'
import { pickWorkflowRepositories } from '../runtime/workflow-repository-catalog'

export interface MarksQueueInput {
  status?: MarksCorrection['status']
  classGroupId?: string
  periodId?: string
  offset?: number
  limit?: number
}

async function correctionActions(base: BaseSchoolService, row: MarksCorrection, classGroupId: string) {
  const pending = row.status === 'pending'
  const author = 'subjectId' in base.actor && row.authorSubjectId === base.actor.subjectId
  const review = pending && !author && base.actor.kind === 'staff' && await base.access.marksReview.can('approve', { classGroupId })
  return { approve: review, reject: review, withdraw: pending && author && await base.access.marksReview.can('submit', { classGroupId }) }
}

export async function listAssessmentMarksReviews(base: BaseSchoolService, input: MarksQueueInput) {
  if (base.actor.kind !== 'staff')
    denyResourceAccess()
  const repositories = pickWorkflowRepositories('assessments', base.repositories)
  const scope = await base.access.marksReview.queueScope()
  const offset = Math.max(0, input.offset ?? 0)
  const limit = Math.min(100, Math.max(1, input.limit ?? 25))
  const page = await repositories.marksCorrections.list(scope, { ...input, offset, limit })
  const sheets = new Map((await repositories.assessments.forAccess(scope).findByIds(page.items.map(row => row.assessmentId))).map(row => [row.id, row]))
  const items = []
  for (const correction of page.items) {
    const assessment = sheets.get(correction.assessmentId)
    if (!assessment)
      denyResourceAccess()
    items.push({ correction, assessment: assessment.data, allowedActions: await correctionActions(base, correction, assessment.classGroupId) })
  }
  return { items, total: page.total, offset, limit }
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
  const published = await repositories.assessmentDependencies.publishedMarkIds(base.actor.schoolId, results.map(row => row.id))
  const history = await repositories.marksCorrections.forAssessment(base.actor.schoolId, assessment.id)
  const corrections = []
  for (const row of history) corrections.push({ ...row, allowedActions: await correctionActions(base, row, assessment.classGroupId) })
  const editable = await base.access.marksReview.can('submit', assessment)
  return {
    assessment: assessment.data,
    students: students.map(student => ({ id: student.id, firstName: student.firstName, lastName: student.lastName })),
    results: results.map(result => result.data),
    missingStudentIds,
    publishedResultIds: [...published],
    corrections,
    allowedActions: {
      submit: assessment.marksStatus === 'draft' && roster.length > 0 && !missingStudentIds.length && editable,
      requestCorrection: assessment.marksStatus === 'submitted' && !history.some(row => row.status === 'pending') && results.some(row => !published.has(row.id)) && editable,
    },
  }
}
