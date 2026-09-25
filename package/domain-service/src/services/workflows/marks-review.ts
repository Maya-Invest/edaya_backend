import type { Assessment } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import { denyResourceAccess } from '@edaya/authorization'
import { Assessment as AssessmentEntity, BusinessRuleViolationError } from '@edaya/core'
import { academicStateLock, assertMarkDesignation, assertMarksDraft, assertMarksRevision, assessmentRoster, invalidateAssessmentDrafts } from '../../capabilities/academics/marks-state'
import { ASSESSMENT_RESULT_RECORDED_EVENT_KEY, runWorkflowNotifications } from '../../capabilities/notifications'
import { schoolCommandScope } from '../commands/school-command-scope'
import { pickWorkflowRepositories } from '../runtime/workflow-repository-catalog'

export interface MarksReviewInput {
  requestId: string
  assessmentId: string
  expectedRevision: number
}
export interface ReturnMarksInput extends MarksReviewInput { reason: string }

/** Review transitions own state fields; ordinary entity writes cannot set them. */
export class MarksReviewWorkflow {
  private readonly repositories
  constructor(private readonly base: BaseSchoolService) {
    this.repositories = pickWorkflowRepositories('assessments', base.repositories)
  }

  async transition(action: 'submit' | 'approve' | 'return', input: MarksReviewInput & { reason?: string }): Promise<Assessment> {
    const actor = this.base.actor
    if (actor.kind !== 'staff' && actor.kind !== 'teacher')
      denyResourceAccess()
    if (action !== 'submit' && actor.kind !== 'staff')
      denyResourceAccess()
    if (action === 'return' && !input.reason?.trim())
      throw new BusinessRuleViolationError('MARKS_RETURN_REASON_REQUIRED', 'Explain why the marks sheet is being returned')
    const command = { submit: 'submitAssessmentMarks', approve: 'approveAssessmentMarks', return: 'returnAssessmentMarks' }[action]
    return this.base.commandExecution.execute({
      scope: await schoolCommandScope(actor, command, input.requestId),
      input,
      resultMode: 'ordinary',
      lockKeys: [academicStateLock(actor.schoolId)],
      authorize: async () => {
        const assessment = await this.repositories.assessments.forSchool!(actor.schoolId).findById(input.assessmentId)
        if (!assessment)
          denyResourceAccess()
        if (action === 'submit') {
          await this.base.access.marksReview.edit(assessment.id)
        }
        else {
          const reviewAction = action === 'return' && (assessment.marksStatus === 'approved' || assessment.marksReview.history.find(event => event.revision === input.expectedRevision)?.action === 'approve') ? 'returnApproved' : action === 'return' ? 'returnSubmitted' : 'approve'
          await this.base.access.marksReview.assertClassAction(reviewAction, assessment.classGroupId)
        }
      },
      execute: async () => {
        const assessment = await this.repositories.assessments.findById(input.assessmentId)
        if (!assessment)
          denyResourceAccess()
        assertMarksRevision(assessment, input.expectedRevision)
        const at = new Date()
        let review = assessment.marksReview
        const results = await this.repositories.assessmentResults.list({ assessmentId: assessment.id })
        if (action === 'submit') {
          assertMarksDraft(assessment)
          const rosterStudentIds = await assessmentRoster(assessment, this.repositories)
          if (!rosterStudentIds.length)
            throw new BusinessRuleViolationError('MARKS_ROSTER_EMPTY', 'An evaluation must have an eligible roster')
          const byStudent = new Map(results.map(result => [result.studentId, result]))
          if (byStudent.size !== results.length || results.some(result => !rosterStudentIds.includes(result.studentId)))
            throw new BusinessRuleViolationError('MARKS_ROSTER_CHANGED', 'Reconcile marks with the evaluation roster before submitting')
          for (const studentId of rosterStudentIds) {
            const result = byStudent.get(studentId)
            if (!result || (!result.designation && result.score === undefined))
              throw new BusinessRuleViolationError('MARKS_INCOMPLETE', 'Every student requires a score, absence or exemption')
            assertMarkDesignation(result)
            if (result.score !== undefined && result.score > assessment.maxScore)
              throw new BusinessRuleViolationError('SCORE_EXCEEDS_MAX_SCORE', 'A recorded mark exceeds the evaluation maximum')
          }
          review = { ...review, rosterStudentIds, submittedBy: actor.subjectId, submittedAt: at, approvedBy: undefined, approvedAt: undefined }
        }
        else if (action === 'approve') {
          if (assessment.marksStatus !== 'submitted')
            throw new BusinessRuleViolationError('MARKS_NOT_SUBMITTED', 'Only submitted marks can be approved')
          if (review.submittedBy === actor.subjectId || review.editedBySubjectIds.includes(actor.subjectId))
            throw new BusinessRuleViolationError('MARKS_SELF_APPROVAL', 'An independent staff reviewer must approve this marks sheet')
          review = { ...review, approvedBy: actor.subjectId, approvedAt: at }
        }
        else {
          if (assessment.marksStatus === 'draft')
            throw new BusinessRuleViolationError('MARKS_ALREADY_DRAFT', 'The marks sheet is already editable')
          const published = await this.repositories.assessmentDependencies.publishedAssessmentIds(actor.schoolId, [assessment.id])
          if (published.has(assessment.id))
            throw new BusinessRuleViolationError('PUBLISHED_REPORT_CARD_IMMUTABLE', 'A published report depends on these marks')
          review = { ...review, approvedBy: undefined, approvedAt: undefined, rosterStudentIds: [] }
        }
        const updated = new AssessmentEntity({
          ...assessment.data,
          marksStatus: action === 'submit' ? 'submitted' : action === 'approve' ? 'approved' : 'draft',
          marksRevision: assessment.marksRevision + 1,
          marksReview: { ...review, history: [...review.history, { action, revision: assessment.marksRevision + 1, subjectId: actor.subjectId, at, ...(action === 'return' ? { reason: input.reason!.trim() } : {}) }] },
        })
        await this.repositories.assessments.save(updated)
        await invalidateAssessmentDrafts(updated, this.repositories)
        if (action === 'approve') {
          const students = new Map((await this.repositories.students.findByIds(results.map(result => result.studentId))).map(student => [student.id, student]))
          for (const result of results) {
            const student = students.get(result.studentId)
            if (student)
              await runWorkflowNotifications(this.base, ASSESSMENT_RESULT_RECORDED_EVENT_KEY, { result, assessment: updated, student })
          }
        }
        return updated
      },
      persistResult: result => ({ id: result.id }),
      replay: async (stored) => {
        const assessment = await this.repositories.assessments.forSchool!(actor.schoolId).findById(stored.id)
        if (!assessment)
          denyResourceAccess()
        return assessment
      },
      audit: result => [{ event: command, resourceType: 'assessments', resourceId: result.id }],
    })
  }
}
