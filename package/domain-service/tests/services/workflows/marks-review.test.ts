import { ActorAssuranceLevel, createGuardianActorMetadata, createStaffActorMetadata } from '@edaya/authorization'
import { Assessment, AssessmentKind, AssessmentResult, ClassSubject, DeadlineComplianceStatus, GradeLevelSubject, Permission, RecordingNotificationGateway, StaffMember, StaffPermissionAssignment, Student, StudentClassEnrollment } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { createReportCardContext } from './report-card-workflow-context'

const reportInput = { id: 'rc1', studentId: 'stu1', periodId: 'per1', reportCardDefinitionId: 'def1' }

async function fixture() {
  const gateway = new RecordingNotificationGateway()
  const f = await createReportCardContext({ marksApproved: false, notificationGateway: gateway })
  await f.repositories.staffMembers.save(new StaffMember({ id: 'reviewer', schoolId: 'sch1', firstName: 'Review', lastName: 'Staff', subjectId: 'reviewer-login' }))
  for (const permission of [Permission.GRADE_VALIDATE, Permission.GRADE_UNLOCK, Permission.GRADE_READ]) {
    await f.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: permission, schoolId: 'sch1', staffId: 'reviewer', academicYearId: 'ay1', permission, scopes: [{ kind: 'class_group', classGroupId: 'cg1' }] }))
  }
  const reviewer = f.forActor(createStaffActorMetadata({ schoolId: 'sch1', staffMemberId: 'reviewer', subjectId: 'reviewer-login', academicYearId: 'ay1', requestId: 'reviewer', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified }))
  const family = f.forActor(createGuardianActorMetadata({ schoolId: 'sch1', guardianId: 'gua1', subjectId: 'subject-gua1', academicYearId: 'ay1', requestId: 'family', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified }))
  const edit = (score = 77.5, revision = 0) => f.service.assessmentsWorkflow.recordAssessmentResult({ requestId: `edit-${revision}`, expectedRevision: revision, id: 'ar1', studentId: 'stu1', assessmentId: 'ass1', score, designation: 'scored' })
  return { ...f, reviewer, family, edit, gateway }
}

describe('evaluation marks review', () => {
  test('homework compliance edits preserve scores and score edits preserve compliance', async () => {
    const f = await fixture()
    const assessment = (await f.repositories.assessments.findById('ass1'))!
    await f.repositories.assessments.save(new Assessment({ ...assessment.data, kind: AssessmentKind.Homework, dueAt: assessment.startsAt, startsAt: undefined, endsAt: undefined }))
    await f.edit()
    const compliance = { requestId: 'compliance', expectedRevision: 1, id: 'ar1', studentId: 'stu1', assessmentId: 'ass1', status: DeadlineComplianceStatus.Late, notes: 'Received next morning' }
    const updated = await f.service.assessmentsWorkflow.recordAssessmentResultCompliance(compliance)
    expect(updated.score).toBe(77.5)
    expect(updated.designation).toBe('scored')
    expect((await f.service.assessmentsWorkflow.recordAssessmentResultCompliance(compliance)).score).toBe(77.5)
    const rescored = await f.edit(85, 2)
    expect(rescored.status).toBe(DeadlineComplianceStatus.Late)
    expect(rescored.notes).toBe('Received next morning')
    const batched = await f.service.assessmentsWorkflow.recordAssessmentResults({ requestId: 'batch-rescore', assessmentId: 'ass1', expectedRevision: 3, results: [{ id: 'ar1', studentId: 'stu1', score: 90 }] })
    expect(batched[0]!.status).toBe(DeadlineComplianceStatus.Late)
    expect(batched[0]!.notes).toBe('Received next morning')
    expect(batched[0]!.createdAt).toEqual(rescored.createdAt)
  })

  test('review separation follows current marks, not removed marks or compliance-only edits', async () => {
    const f = await fixture()
    const assessment = (await f.repositories.assessments.findById('ass1'))!
    await f.repositories.assessments.save(new Assessment({ ...assessment.data, kind: AssessmentKind.Homework, dueAt: assessment.startsAt, startsAt: undefined, endsAt: undefined }))
    for (const permission of [Permission.GRADE_INPUT, Permission.GRADE_UPDATE]) {
      await f.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: `editor-${permission}`, schoolId: 'sch1', staffId: 'reviewer', academicYearId: 'ay1', permission, scopes: [{ kind: 'class_group', classGroupId: 'cg1' }] }))
    }
    await f.reviewer.assessmentsWorkflow.recordAssessmentResult({ requestId: 'reviewer-edit', expectedRevision: 0, id: 'ar1', studentId: 'stu1', assessmentId: 'ass1', score: 42 })
    expect((await f.repositories.assessments.findById('ass1'))!.marksReview.editedBySubjectIds).toContain('reviewer-login')
    await f.service.baseService.entities.assessmentResults.delete('ar1')
    expect((await f.repositories.assessments.findById('ass1'))!.marksReview.editedBySubjectIds).not.toContain('reviewer-login')
    await f.edit(85, 2)
    await f.reviewer.assessmentsWorkflow.recordAssessmentResultCompliance({ requestId: 'reviewer-compliance', expectedRevision: 3, id: 'ar1', studentId: 'stu1', assessmentId: 'ass1', status: DeadlineComplianceStatus.Late })
    await f.service.assessmentsWorkflow.submitAssessmentMarks({ assessmentId: 'ass1', requestId: 'submit-current', expectedRevision: 4 })
    expect((await f.reviewer.assessmentsWorkflow.approveAssessmentMarks({ assessmentId: 'ass1', requestId: 'approve-current', expectedRevision: 5 })).marksStatus).toBe('approved')
  })

  test('curriculum edits and resynchronization cannot change submitted grading configuration', async () => {
    const f = await fixture()
    const group = (await f.repositories.classGroups.findById('cg1'))!
    const subject = (await f.repositories.classSubjects.findById('cs1'))!
    const allocation = new GradeLevelSubject({ id: 'gls1', gradeLevelId: group.gradeLevelId, academicYearId: group.academicYearId, subjectId: subject.subjectId, coefficient: 1, isOptional: false })
    await f.repositories.gradeLevelSubjects.save(allocation)
    await f.repositories.classSubjects.save(new ClassSubject({ ...subject.data, gradeLevelSubjectId: allocation.id, coefficient: 1 }))
    await f.edit()
    await f.service.assessmentsWorkflow.submitAssessmentMarks({ assessmentId: 'ass1', requestId: 'freeze-curriculum', expectedRevision: 1 })
    await expect(f.service.academicsWorkflow.updateGradeLevelSubject({ gradeLevelSubjectId: allocation.id, coefficient: 2 })).rejects.toMatchObject({ code: 'ASSESSMENT_MARKS_FROZEN' })
    await expect(f.service.academicsWorkflow.offerSubjectToGradeLevel({ ...allocation.data, coefficient: 2 })).rejects.toMatchObject({ code: 'ASSESSMENT_MARKS_FROZEN' })
    expect((await f.repositories.classSubjects.findById('cs1'))!.coefficient).toBe(1)
    expect((await f.repositories.gradeLevelSubjects.findById('gls1'))!.coefficient).toBe(1)
  })

  test('batch grades preserve revision counts, reject duplicate targets and roll back mixed invalid writes', async () => {
    const f = await fixture()
    const student = (await f.repositories.students.findById('stu1'))!
    const enrollment = (await f.repositories.enrollments.findOne({ studentId: 'stu1', classGroupId: 'cg1' }))!
    await f.repositories.students.save(new Student({ ...student.data, id: 'stu2', subjectId: undefined }))
    await f.repositories.enrollments.save(new StudentClassEnrollment({ ...enrollment.data, id: 'enr2', studentId: 'stu2' }))
    const mark = (id: string, studentId: string, score: number) => new AssessmentResult({ id, studentId, assessmentId: 'ass1', score })
    await expect(f.service.baseService.entities.assessmentResults.batchSave([mark('ar1', 'stu1', 12), mark('duplicate', 'stu1', 13)])).rejects.toMatchObject({ code: 'DUPLICATE_ASSESSMENT_MARK' })
    expect((await f.repositories.assessments.findById('ass1'))!.marksRevision).toBe(0)
    const batch = { requestId: 'batch-command', assessmentId: 'ass1', expectedRevision: 0, results: [{ id: 'ar1', studentId: 'stu1', score: 77.5 }, { id: 'ar2', studentId: 'stu2', score: 90 }] }
    await f.service.assessmentsWorkflow.recordAssessmentResults(batch)
    expect(await f.service.assessmentsWorkflow.recordAssessmentResults(batch)).toHaveLength(2)
    await expect(f.service.assessmentsWorkflow.recordAssessmentResults({ ...batch, results: [{ id: 'ar1', studentId: 'stu1', score: 1 }] })).rejects.toMatchObject({ code: 'COMMAND_REPLAY_CONFLICT' })
    expect((await f.repositories.assessments.findById('ass1'))!.marksRevision).toBe(2)
    await expect(f.service.baseService.entities.assessmentResults.batchSave([mark('ar1', 'stu1', 1), mark('foreign', 'missing-student', 10)])).rejects.toThrow()
    expect((await f.repositories.assessmentResults.findById('ar1'))!.score).toBe(77.5)
    await f.service.assessmentsWorkflow.submitAssessmentMarks({ assessmentId: 'ass1', requestId: 'submit-batch', expectedRevision: 2 })
    await expect(f.service.baseService.entities.assessmentResults.batchSave([mark('ar1', 'stu1', 1), mark('ar2', 'stu2', 10)])).rejects.toMatchObject({ code: 'ASSESSMENT_MARKS_FROZEN' })
    expect((await f.repositories.assessments.findById('ass1'))!.marksRevision).toBe(3)
  })

  test('freezes submission, denies self-review, exposes only approved marks and preserves publication evidence', async () => {
    const f = await fixture()
    await f.edit()
    expect(await f.family.baseService.entities.assessmentResults.count()).toBe(0)
    expect(f.gateway.enqueued).toHaveLength(0)
    const draft = await f.service.assessmentsWorkflow.generateReportCardResult(reportInput)
    expect(draft.overallAverage).toBeUndefined()
    expect(draft.pendingAssessmentIds).toEqual(['ass1'])
    await expect(f.service.assessmentsWorkflow.publishReportCardResult(reportInput)).rejects.toMatchObject({ code: 'REPORT_CARD_MARKS_NOT_APPROVED' })
    const input = { assessmentId: 'ass1', requestId: 'submit', expectedRevision: 1 }
    const submitted = await f.service.assessmentsWorkflow.submitAssessmentMarks(input)
    expect(submitted.marksStatus).toBe('submitted')
    expect((await f.service.assessmentsWorkflow.submitAssessmentMarks(input)).marksRevision).toBe(2)
    await expect(f.service.baseService.entities.assessmentResults.save(new AssessmentResult({ id: 'ar1', studentId: 'stu1', assessmentId: 'ass1', score: 80 }))).rejects.toMatchObject({ code: 'ASSESSMENT_MARKS_FROZEN' })
    await expect(f.service.baseService.entities.assessmentResults.delete('ar1')).rejects.toMatchObject({ code: 'ASSESSMENT_MARKS_FROZEN' })
    await expect(f.service.assessmentsWorkflow.approveAssessmentMarks({ assessmentId: 'ass1', requestId: 'self-review', expectedRevision: 2 })).rejects.toMatchObject({ code: 'MARKS_SELF_APPROVAL' })
    const approved = await f.reviewer.assessmentsWorkflow.approveAssessmentMarks({ assessmentId: 'ass1', requestId: 'approve', expectedRevision: 2 })
    expect(approved.marksStatus).toBe('approved')
    expect(approved.marksReview.history.map(row => row.action)).toEqual(['submit', 'approve'])
    expect(await f.family.baseService.entities.assessmentResults.count()).toBe(1)
    expect(f.gateway.enqueued).toHaveLength(2)
    const generated = await f.service.assessmentsWorkflow.generateReportCardResult(reportInput)
    expect(generated.overallAverage).toBe(15.5)
    expect(generated.sourceAssessments).toEqual([{ assessmentId: 'ass1', revision: 3 }])
    await f.service.assessmentsWorkflow.writeReportCardSectionComments({ id: 'rc1', requestId: 'comment', expectedVersion: generated.version, sections: [{ sectionId: 'sec-math', comment: 'Excellent progress' }] })
    const published = await f.service.assessmentsWorkflow.publishReportCardResult({ ...reportInput, id: 'different-request-id' })
    expect(published.id).toBe('rc1')
    expect(published.sectionResults[0]?.subResults[0]?.comment).toBe('Excellent progress')
    expect(published.overallAverage).toBe(15.5)
    expect((await f.service.assessmentsWorkflow.publishReportCardResult({ ...reportInput, id: 'different-request-id' })).id).toBe('rc1')
    await expect(f.reviewer.assessmentsWorkflow.returnAssessmentMarks({ assessmentId: 'ass1', requestId: 'return', expectedRevision: 3, reason: 'Correction' })).rejects.toMatchObject({ code: 'PUBLISHED_REPORT_CARD_IMMUTABLE' })
  })

  test('regeneration preserves section comments when all marks become absent without turning no score into zero', async () => {
    const f = await fixture()
    await f.edit()
    await f.service.assessmentsWorkflow.submitAssessmentMarks({ assessmentId: 'ass1', requestId: 'submit-scored', expectedRevision: 1 })
    await f.reviewer.assessmentsWorkflow.approveAssessmentMarks({ assessmentId: 'ass1', requestId: 'approve-scored', expectedRevision: 2 })
    const draft = await f.service.assessmentsWorkflow.generateReportCardResult(reportInput)
    await f.service.assessmentsWorkflow.writeReportCardSectionComments({ id: draft.id, requestId: 'comment-scored', expectedVersion: draft.version, sections: [{ sectionId: 'sec-math', comment: 'Pending attendance correction' }] })
    await f.reviewer.assessmentsWorkflow.returnAssessmentMarks({ assessmentId: 'ass1', requestId: 'return-scored', expectedRevision: 3, reason: 'Incorrect attendance' })
    await f.service.assessmentsWorkflow.recordAssessmentResult({ id: 'ar1', studentId: 'stu1', assessmentId: 'ass1', requestId: 'absent-correction', expectedRevision: 4, designation: 'absent' })
    await f.service.assessmentsWorkflow.submitAssessmentMarks({ assessmentId: 'ass1', requestId: 'submit-absent', expectedRevision: 5 })
    await f.reviewer.assessmentsWorkflow.approveAssessmentMarks({ assessmentId: 'ass1', requestId: 'approve-absent', expectedRevision: 6 })
    const regenerated = await f.service.assessmentsWorkflow.generateReportCardResult(reportInput)
    expect(regenerated.overallAverage).toBeUndefined()
    expect(regenerated.sectionResults[0]!.average).toBeUndefined()
    expect(regenerated.sectionResults[0]!.subResults[0]!.average).toBeUndefined()
    expect(regenerated.sectionResults[0]!.subResults[0]!.comment).toBe('Pending attendance correction')
  })

  test('requires completeness, permits absence without zero, returns with history, and rejects stale edits', async () => {
    const f = await fixture()
    await f.repositories.assessmentResults.delete('ar1')
    await expect(f.service.assessmentsWorkflow.submitAssessmentMarks({ assessmentId: 'ass1', requestId: 'incomplete', expectedRevision: 0 })).rejects.toMatchObject({ code: 'MARKS_INCOMPLETE' })
    await f.service.assessmentsWorkflow.recordAssessmentResult({ requestId: 'absent', expectedRevision: 0, id: 'ar1', studentId: 'stu1', assessmentId: 'ass1', designation: 'absent' })
    await f.service.assessmentsWorkflow.submitAssessmentMarks({ assessmentId: 'ass1', requestId: 'submit', expectedRevision: 1 })
    await expect(f.reviewer.assessmentsWorkflow.approveAssessmentMarks({ assessmentId: 'ass1', requestId: 'stale-review', expectedRevision: 1 })).rejects.toMatchObject({ code: 'MARKS_REVISION_CONFLICT' })
    const returned = await f.reviewer.assessmentsWorkflow.returnAssessmentMarks({ assessmentId: 'ass1', requestId: 'return', expectedRevision: 2, reason: 'Check the attendance register' })
    expect(returned.marksStatus).toBe('draft')
    expect(returned.marksReview.history.at(-1)?.reason).toBe('Check the attendance register')
    await expect(f.edit(90, 0)).rejects.toMatchObject({ code: 'MARKS_REVISION_CONFLICT' })
    await f.service.baseService.entities.assessmentResults.delete('ar1')
    await expect(f.service.baseService.entities.assessments.delete('ass1')).rejects.toMatchObject({ code: 'ASSESSMENT_REVIEW_HISTORY_RETAINED' })
    await expect(f.service.baseService.entities.assessments.batchDelete(['ass1'])).rejects.toMatchObject({ code: 'ASSESSMENT_REVIEW_HISTORY_RETAINED' })
    expect((await f.repositories.assessments.findById('ass1'))!.marksReview.history).toEqual(returned.marksReview.history)
  })

  test('prevents direct review-field mutation and invalid scoring edits while allowing completion', async () => {
    const f = await fixture()
    const current = (await f.repositories.assessments.findById('ass1'))!
    await expect(f.service.baseService.entities.assessments.save(new Assessment({ ...current.data, marksStatus: 'approved' }))).rejects.toMatchObject({ code: 'MARKS_STATE_COMMAND_REQUIRED' })
    await expect(f.service.baseService.entities.assessments.save(new Assessment({ ...current.data, maxScore: 50 }))).rejects.toMatchObject({ code: 'SCORE_EXCEEDS_MAX_SCORE' })
    await f.service.assessmentsWorkflow.completeAssessment({ assessmentId: 'ass1' })
    expect((await f.repositories.assessments.findById('ass1'))?.completedAt).toBeDefined()
  })
})
