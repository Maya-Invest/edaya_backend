import type { Assessment, AssessmentResult, DecideMarksCorrectionInput, MarksCorrection, RejectMarksCorrectionInput, RequestMarksCorrectionInput } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import { denyResourceAccess } from '@edaya/authorization'
import { Assessment as AssessmentEntity, BusinessRuleViolationError, decideMarksCorrectionSchema, rejectMarksCorrectionSchema, requestMarksCorrectionSchema, AssessmentResult as ResultEntity } from '@edaya/core'
import { academicStateLock, assertMarkDesignation, assertMarksRevision } from '../../capabilities/academics/marks-state'
import { ASSESSMENT_RESULT_RECORDED_EVENT_KEY, runWorkflowNotifications } from '../../capabilities/notifications'
import { schoolCommandScope } from '../commands/school-command-scope'
import { pickWorkflowRepositories } from '../runtime/workflow-repository-catalog'

function values(mark: AssessmentResult) {
  return { score: mark.score ?? null, designation: mark.designation ?? 'scored' as const, notes: mark.notes ?? null }
}
function fail(code: string, message: string): never {
  throw new BusinessRuleViolationError(code, message)
}

/** Pending proposals never mutate official marks. All writes share publication's transaction lock. */
export class MarksCorrectionsWorkflow {
  private readonly repositories
  constructor(private readonly base: BaseSchoolService) { this.repositories = pickWorkflowRepositories('assessments', base.repositories) }

  private async editable(assessmentId: string) {
    if (this.base.actor.kind !== 'staff' && this.base.actor.kind !== 'teacher')
      denyResourceAccess()
    await this.base.access.marksReview.edit(assessmentId)
    const sheet = await this.repositories.assessments.forSchool!(this.base.actor.schoolId).findById(assessmentId)
    if (!sheet)
      denyResourceAccess()
    return sheet
  }

  private async unlocked(ids: string[]) {
    if ((await this.repositories.assessmentDependencies.publishedMarkIds(this.base.actor.schoolId, ids)).size)
      fail('PUBLISHED_REPORT_CARD_IMMUTABLE', 'A proposed mark is included in a published report and cannot be revised')
  }

  async request(raw: RequestMarksCorrectionInput): Promise<MarksCorrection> {
    const input = requestMarksCorrectionSchema.parse(raw)
    const actor = this.base.actor
    if (actor.kind !== 'staff' && actor.kind !== 'teacher')
      denyResourceAccess()
    return this.base.commandExecution.execute({
      scope: await schoolCommandScope(actor, 'requestAssessmentMarksCorrection', input.requestId),
      input,
      resultMode: 'ordinary',
      lockKeys: [academicStateLock(actor.schoolId)],
      authorize: async () => { await this.editable(input.assessmentId) },
      execute: async () => {
        const sheet = await this.editable(input.assessmentId)
        if (sheet.marksStatus !== 'submitted')
          fail('MARKS_NOT_SUBMITTED', 'Submit the marks before requesting a correction')
        assertMarksRevision(sheet, input.expectedRevision)
        if ((await this.repositories.marksCorrections.forAssessment(actor.schoolId, sheet.id)).some(row => row.status === 'pending'))
          fail('MARKS_CORRECTION_PENDING', 'Resolve or withdraw the pending correction first')
        const ids = input.changes.map(row => row.resultId)
        if (new Set(ids).size !== ids.length)
          fail('DUPLICATE_ASSESSMENT_MARK', 'Each mark may appear only once in a correction')
        await this.unlocked(ids)
        const marks = new Map((await this.repositories.assessmentResults.findByIds(ids)).map(row => [row.id, row]))
        const changes = input.changes.map((change) => {
          const mark = marks.get(change.resultId)
          if (!mark || mark.assessmentId !== sheet.id || !sheet.marksReview.rosterStudentIds.includes(mark.studentId))
            denyResourceAccess()
          const proposedMark = new ResultEntity({ ...mark.data, ...change.proposed })
          this.validate(sheet, proposedMark)
          const before = values(mark)
          const proposed = values(proposedMark)
          if (JSON.stringify(before) === JSON.stringify(proposed))
            fail('MARKS_CORRECTION_UNCHANGED', 'Every proposed correction must change a mark')
          return { resultId: mark.id, studentId: mark.studentId, revision: mark.revision, before, proposed }
        })
        const row: MarksCorrection = { id: crypto.randomUUID(), schoolId: actor.schoolId, assessmentId: sheet.id, status: 'pending', version: 0, baseRevision: sheet.marksRevision, authorSubjectId: actor.subjectId, reason: input.reason, createdAt: new Date(), changes }
        await this.repositories.marksCorrections.save(row)
        return row
      },
      persistResult: row => ({ id: row.id }),
      replay: stored => this.require(stored.id),
      audit: row => [{ event: 'requestAssessmentMarksCorrection', resourceType: 'assessments', resourceId: row.assessmentId }],
    })
  }

  private validate(sheet: Assessment, mark: AssessmentResult) {
    assertMarkDesignation(mark)
    if (mark.score !== undefined && mark.score > sheet.maxScore)
      fail('SCORE_EXCEEDS_MAX_SCORE', 'A proposed score exceeds the evaluation maximum')
  }

  private async require(id: string) {
    const row = await this.repositories.marksCorrections.find(this.base.actor.schoolId, id)
    if (!row)
      denyResourceAccess()
    return row
  }

  async decide(action: 'approve' | 'reject' | 'withdraw', raw: DecideMarksCorrectionInput | RejectMarksCorrectionInput): Promise<MarksCorrection> {
    const input = action === 'reject' ? rejectMarksCorrectionSchema.parse(raw) : decideMarksCorrectionSchema.parse(raw)
    const actor = this.base.actor
    if (actor.kind !== 'staff' && actor.kind !== 'teacher')
      denyResourceAccess()
    const command = { approve: 'approveAssessmentMarksCorrection', reject: 'rejectAssessmentMarksCorrection', withdraw: 'withdrawAssessmentMarksCorrection' }[action]
    return this.base.commandExecution.execute({
      scope: await schoolCommandScope(actor, command, input.requestId),
      input,
      resultMode: 'ordinary',
      lockKeys: [academicStateLock(actor.schoolId)],
      authorize: async () => {
        const row = await this.require(input.correctionId)
        if (action === 'withdraw') {
          if (row.authorSubjectId !== actor.subjectId)
            denyResourceAccess()
          await this.editable(row.assessmentId)
        }
        else {
          if (actor.kind !== 'staff')
            denyResourceAccess()
          const sheet = await this.repositories.assessments.forSchool!(actor.schoolId).findById(row.assessmentId)
          if (!sheet)
            denyResourceAccess()
          await this.base.access.marksReview.assertClassAction('approve', sheet.classGroupId)
          if (row.authorSubjectId === actor.subjectId)
            fail('MARKS_SELF_APPROVAL', 'The correction author cannot review their own request')
        }
      },
      execute: async () => {
        const row = await this.require(input.correctionId)
        if (row.version !== input.expectedVersion)
          fail('MARKS_CORRECTION_VERSION_CONFLICT', 'The correction changed; reload before reviewing')
        if (row.status !== 'pending')
          fail('MARKS_CORRECTION_NOT_PENDING', 'This correction has already been resolved')
        if (action === 'approve') {
          const sheet = await this.repositories.assessments.findById(row.assessmentId)
          if (!sheet || sheet.marksStatus !== 'submitted')
            fail('MARKS_NOT_SUBMITTED', 'The evaluation must remain submitted')
          assertMarksRevision(sheet, row.baseRevision)
          await this.unlocked(row.changes.map(change => change.resultId))
          const originals = new Map((await this.repositories.assessmentResults.findByIds(row.changes.map(change => change.resultId))).map(mark => [mark.id, mark]))
          const updated = row.changes.map((change) => {
            const mark = originals.get(change.resultId)
            if (!mark || mark.assessmentId !== sheet.id || mark.studentId !== change.studentId || mark.revision !== change.revision || JSON.stringify(values(mark)) !== JSON.stringify(change.before))
              fail('MARKS_REVISION_CONFLICT', 'A source mark changed; submit a new correction')
            const result = new ResultEntity({ ...mark.data, ...change.proposed, revision: mark.revision + 1 })
            this.validate(sheet, result)
            return result
          })
          const updatedSheet = new AssessmentEntity({ ...sheet.data, marksRevision: sheet.marksRevision + 1 })
          await this.repositories.assessmentResults.batchSave(updated)
          await this.repositories.assessments.save(updatedSheet)
          await this.repositories.assessmentDependencies.invalidateMarkDrafts(actor.schoolId, updated.map(mark => mark.id))
          const students = new Map((await this.repositories.students.findByIds(updated.map(mark => mark.studentId))).map(student => [student.id, student]))
          for (const result of updated) {
            const student = students.get(result.studentId)
            if (student)
              await runWorkflowNotifications(this.base, ASSESSMENT_RESULT_RECORDED_EVENT_KEY, { result, student, assessment: updatedSheet })
          }
        }
        const decided: MarksCorrection = { ...row, status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'withdrawn', version: row.version + 1, decidedBy: actor.subjectId, decidedAt: new Date(), ...('reason' in input && typeof input.reason === 'string' ? { rejectionReason: input.reason } : {}) }
        await this.repositories.marksCorrections.save(decided)
        return decided
      },
      persistResult: row => ({ id: row.id }),
      replay: stored => this.require(stored.id),
      audit: row => [{ event: command, resourceType: 'assessments', resourceId: row.assessmentId }],
    })
  }
}
