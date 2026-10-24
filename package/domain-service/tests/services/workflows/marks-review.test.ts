import { ActorAssuranceLevel, createGuardianActorMetadata, createStaffActorMetadata } from '@edaya/authorization'
import { AcademicPeriod, AcademicPeriodType, Assessment, AssessmentKind, AssessmentResult, ClassGroup, ClassSubject, DeadlineComplianceStatus, Permission, RecordingNotificationGateway, ReportCardAggregationSource, StaffMember, StaffPermissionAssignment, Student, StudentClassEnrollment, Subject } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { seedSubjectParticipation } from '../../support/seed-subject-participation'
import { createReportCardContext } from './report-card-workflow-context'

const reportInput = { id: 'rc1', studentId: 'stu1', periodId: 'per1', reportCardDefinitionId: 'def1' }

async function fixture() {
  const gateway = new RecordingNotificationGateway()
  const f = await createReportCardContext({ marksApproved: false, notificationGateway: gateway })
  await f.repositories.staffMembers.save(new StaffMember({ id: 'reviewer', schoolId: 'sch1', firstName: 'Review', lastName: 'Staff', subjectId: 'reviewer-login' }))
  for (const permission of [Permission.GRADE_VALIDATE, Permission.GRADE_READ]) {
    await f.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: permission, schoolId: 'sch1', staffId: 'reviewer', academicYearId: 'ay1', permission, scopes: [{ kind: 'class_group', classGroupId: 'cg1' }] }))
  }
  const reviewer = f.forActor(createStaffActorMetadata({ schoolId: 'sch1', staffMemberId: 'reviewer', subjectId: 'reviewer-login', academicYearId: 'ay1', requestId: 'reviewer', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified }))
  const family = f.forActor(createGuardianActorMetadata({ schoolId: 'sch1', guardianId: 'gua1', subjectId: 'subject-gua1', academicYearId: 'ay1', requestId: 'family', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified }))
  const edit = (score = 77.5, revision = 0) => f.service.assessmentsWorkflow.recordAssessmentResult({ requestId: `edit-${revision}`, expectedRevision: revision, id: 'ar1', studentId: 'stu1', assessmentId: 'ass1', score, designation: 'scored' })
  return { ...f, reviewer, family, edit, gateway }
}

function correctionInput(score: number | null = 85, designation: 'scored' | 'absent' | 'exempt' = 'scored') {
  return { requestId: 'correction', assessmentId: 'ass1', expectedRevision: 2, reason: 'Checked original paper', changes: [{ resultId: 'ar1', proposed: { score, designation, notes: null } }] }
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
    for (const permission of [Permission.GRADE_MANAGE, Permission.GRADE_MANAGE]) {
      await f.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: `editor-${permission}`, schoolId: 'sch1', staffId: 'reviewer', academicYearId: 'ay1', permission, scopes: [{ kind: 'class_group', classGroupId: 'cg1' }] }))
    }
    await f.reviewer.assessmentsWorkflow.recordAssessmentResult({ requestId: 'reviewer-edit', expectedRevision: 0, id: 'ar1', studentId: 'stu1', assessmentId: 'ass1', score: 42 })
    expect((await f.repositories.assessments.findById('ass1'))!.marksReview.editedBySubjectIds).toContain('reviewer-login')
    await f.service.baseService.entities.assessmentResults.delete('ar1')
    expect((await f.repositories.assessments.findById('ass1'))!.marksReview.editedBySubjectIds).not.toContain('reviewer-login')
    await f.edit(85, 2)
    await f.reviewer.assessmentsWorkflow.recordAssessmentResultCompliance({ requestId: 'reviewer-compliance', expectedRevision: 3, id: 'ar1', studentId: 'stu1', assessmentId: 'ass1', status: DeadlineComplianceStatus.Late })
    await f.service.assessmentsWorkflow.submitAssessmentMarks({ assessmentId: 'ass1', requestId: 'submit-current', expectedRevision: 4 })
    expect((await f.repositories.assessments.findById('ass1'))!.marksStatus).toBe('submitted')
  })

  test('curriculum edits and resynchronization cannot change submitted grading configuration', async () => {
    const f = await fixture()
    const offering = (await f.repositories.classSubjects.findById('cs1'))!
    const allocation = (await f.repositories.subjects.findById(offering.subjectId))!.copyWith({ coefficient: 1 })
    await f.repositories.subjects.save(allocation)
    await f.edit()
    await f.service.assessmentsWorkflow.submitAssessmentMarks({ assessmentId: 'ass1', requestId: 'freeze-curriculum', expectedRevision: 1 })
    await expect(f.service.academicsWorkflow.updateSubject({ subjectId: allocation.id, coefficient: 2 })).rejects.toMatchObject({ code: 'ASSESSMENT_MARKS_FROZEN' })
    await expect(f.service.academicsWorkflow.configureSubject({ ...allocation.data, coefficient: 2 })).rejects.toMatchObject({ code: 'ASSESSMENT_MARKS_FROZEN' })
    expect((await f.repositories.classSubjects.findById('cs1'))!.coefficient).toBe(1)
    expect((await f.repositories.subjects.findById(allocation.id))!.coefficient).toBe(1)
  })

  test('batch grades preserve revision counts, reject duplicate targets and roll back mixed invalid writes', async () => {
    const f = await fixture()
    const student = (await f.repositories.students.findById('stu1'))!
    const enrollment = (await f.repositories.enrollments.findOne({ studentId: 'stu1', classGroupId: 'cg1' }))!
    await f.repositories.students.save(new Student({ ...student.data, id: 'stu2', subjectId: undefined }))
    await f.repositories.enrollments.save(new StudentClassEnrollment({ ...enrollment.data, id: 'enr2', studentId: 'stu2' }))
    await seedSubjectParticipation(f.repositories)
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

  test('submission exposes official marks, preserves decimals/comments, and publication locks source marks', async () => {
    const f = await fixture()
    await f.edit()
    expect(await f.family.baseService.entities.assessmentResults.count()).toBe(0)
    expect(f.gateway.enqueued).toHaveLength(0)
    const draft = await f.service.assessmentsWorkflow.generateReportCardResult(reportInput)
    expect(draft.overallAverage).toBeUndefined()
    expect(draft.pendingAssessmentIds).toEqual(['ass1'])
    await expect(f.service.assessmentsWorkflow.publishReportCardResult(reportInput)).rejects.toMatchObject({ code: 'REPORT_CARD_MARKS_NOT_SUBMITTED' })
    const input = { assessmentId: 'ass1', requestId: 'submit', expectedRevision: 1 }
    expect((await f.service.assessmentsWorkflow.submitAssessmentMarks(input)).marksStatus).toBe('submitted')
    expect((await f.service.assessmentsWorkflow.submitAssessmentMarks(input)).marksRevision).toBe(2)
    expect(await f.family.baseService.entities.assessmentResults.count()).toBe(1)
    expect(f.gateway.enqueued).toHaveLength(2)
    await expect(f.service.baseService.entities.assessmentResults.save(new AssessmentResult({ id: 'ar1', studentId: 'stu1', assessmentId: 'ass1', score: 80 }))).rejects.toMatchObject({ code: 'ASSESSMENT_MARKS_FROZEN' })
    await expect(f.service.baseService.entities.assessmentResults.delete('ar1')).rejects.toMatchObject({ code: 'ASSESSMENT_MARKS_FROZEN' })
    const generated = await f.service.assessmentsWorkflow.generateReportCardResult(reportInput)
    expect(generated.overallAverage).toBe(15.5)
    expect(generated.sourceMarks).toEqual([{ resultId: 'ar1', assessmentId: 'ass1', revision: 1 }])
    await f.service.assessmentsWorkflow.writeReportCardSectionComments({ id: 'rc1', requestId: 'comment', expectedVersion: generated.version, sections: [{ sectionId: 'sec-math', comment: 'Excellent progress' }] })
    const published = await f.service.assessmentsWorkflow.publishReportCardResult({ ...reportInput, id: 'different-request-id' })
    expect(published.id).toBe('rc1')
    expect(published.sectionResults[0]?.subResults[0]?.comment).toBe('Excellent progress')
    expect(published.overallAverage).toBe(15.5)
    expect((await f.service.assessmentsWorkflow.publishReportCardResult({ ...reportInput, id: 'different-request-id' })).id).toBe('rc1')
    await expect(f.service.assessmentsWorkflow.requestAssessmentMarksCorrection(correctionInput())).rejects.toMatchObject({ code: 'PUBLISHED_REPORT_CARD_IMMUTABLE' })
  })

  test('publication excludes subjects absent from the report definition from blockers and permanent locks', async () => {
    const f = await fixture()
    await f.edit()
    await f.service.assessmentsWorkflow.submitAssessmentMarks({ assessmentId: 'ass1', requestId: 'submit', expectedRevision: 1 })
    await f.repositories.subjects.save(new Subject({ gradeLevelId: 'grade1', academicYearId: 'ay1', id: 'art', schoolId: 'sch1', name: 'Art' }))
    await f.repositories.classSubjects.save(new ClassSubject({ ...(await f.repositories.classSubjects.findById('cs1'))!.data, id: 'cs-art', subjectId: 'art' }))
    await f.repositories.assessments.save(new Assessment({ ...(await f.repositories.assessments.findById('ass1'))!.data, id: 'ass-art', classSubjectId: 'cs-art' }))
    await f.repositories.assessmentResults.save(new AssessmentResult({ id: 'ar-art', assessmentId: 'ass-art', studentId: 'stu1', score: 50 }))
    const pending = await f.service.assessmentsWorkflow.requestAssessmentMarksCorrection({ ...correctionInput(), assessmentId: 'ass-art', changes: [{ resultId: 'ar-art', proposed: { score: 60, designation: 'scored', notes: null } }] })
    const report = await f.service.assessmentsWorkflow.publishReportCardResult(reportInput)
    expect(report.sourceMarks.map(row => row.resultId)).toEqual(['ar1'])
    expect(report.pendingCorrectionIds).toEqual([])
    await f.reviewer.assessmentsWorkflow.approveAssessmentMarksCorrection({ requestId: 'approve-art', correctionId: pending.id, expectedVersion: 0 })
    expect((await f.repositories.assessmentResults.findById('ar-art'))!.score).toBe(60)
  })

  test('transferred marks retain per-student correction blockers and permanent locks in multi-period reports', async () => {
    const f = await fixture()
    await f.edit()
    await f.service.assessmentsWorkflow.submitAssessmentMarks({ assessmentId: 'ass1', requestId: 'submit', expectedRevision: 1 })
    await f.repositories.classGroups.save(new ClassGroup({ ...(await f.repositories.classGroups.findById('cg1'))!.data, id: 'cg-destination', name: 'Destination' }))
    await f.repositories.classSubjects.save(new ClassSubject({ ...(await f.repositories.classSubjects.findById('cs1'))!.data, id: 'cs-destination', classGroupId: 'cg-destination' }))
    await f.service.studentWorkflow.transferStudent({ enrollmentId: 'enr1', nextEnrollmentId: 'enr-transfer', nextClassGroupId: 'cg-destination', effectiveAt: new Date('2026-02-15') })
    const sourcePeriod = (await f.repositories.academicPeriods.findById('per1'))!
    await f.repositories.academicPeriods.save(new AcademicPeriod({ ...sourcePeriod.data, id: 'per-aggregate', name: 'Aggregate', type: AcademicPeriodType.Other }))
    const input = { ...reportInput, periodId: 'per-aggregate', aggregation: { source: ReportCardAggregationSource.Assessments, sourcePeriodIds: ['per1', 'per-t1'] } }
    const draft = await f.service.assessmentsWorkflow.generateReportCardResult(input)
    expect(draft.classGroupId).toBe('cg-destination')
    expect(draft.sourceMarks.map(row => row.resultId)).toEqual(['ar1'])
    expect(draft.overallAverage).toBe(15.5)
    const correction = await f.service.assessmentsWorkflow.requestAssessmentMarksCorrection(correctionInput())
    await expect(f.service.assessmentsWorkflow.publishReportCardResult(input)).rejects.toMatchObject({ code: 'REPORT_CARD_CORRECTIONS_PENDING' })
    await f.reviewer.assessmentsWorkflow.approveAssessmentMarksCorrection({ requestId: 'approve-transfer', correctionId: correction.id, expectedVersion: 0 })
    const published = await f.service.assessmentsWorkflow.publishReportCardResult(input)
    expect(published.overallAverage).toBe(17)
    expect(published.sourceMarks).toEqual([{ resultId: 'ar1', assessmentId: 'ass1', revision: 2 }])
    await expect(f.service.assessmentsWorkflow.requestAssessmentMarksCorrection({ ...correctionInput(90), requestId: 'published-transfer', expectedRevision: 3 })).rejects.toMatchObject({ code: 'PUBLISHED_REPORT_CARD_IMMUTABLE' })
  })

  test('pending corrections preserve official values, block publication, and approval invalidates draft calculations', async () => {
    const f = await fixture()
    await f.edit()
    await f.service.assessmentsWorkflow.submitAssessmentMarks({ assessmentId: 'ass1', requestId: 'submit', expectedRevision: 1 })
    const draft = await f.service.assessmentsWorkflow.generateReportCardResult(reportInput)
    await f.service.assessmentsWorkflow.writeReportCardSectionComments({ id: draft.id, requestId: 'comment', expectedVersion: draft.version, sections: [{ sectionId: 'sec-math', comment: 'Retain this comment' }] })
    const input = correctionInput(null, 'absent')
    const correction = await f.service.assessmentsWorkflow.requestAssessmentMarksCorrection(input)
    expect((await f.service.assessmentsWorkflow.requestAssessmentMarksCorrection(input)).id).toBe(correction.id)
    await expect(f.service.assessmentsWorkflow.requestAssessmentMarksCorrection({ ...input, reason: 'Changed retry' })).rejects.toMatchObject({ code: 'COMMAND_REPLAY_CONFLICT' })
    expect((await f.family.baseService.entities.assessmentResults.findById('ar1'))!.score).toBe(77.5)
    expect((await f.repositories.assessments.findById('ass1'))!.marksRevision).toBe(2)
    expect((await f.repositories.results.findById(draft.id))!.pendingCorrectionIds).toEqual([correction.id])
    await expect(f.service.assessmentsWorkflow.publishReportCardResult(reportInput)).rejects.toMatchObject({ code: 'REPORT_CARD_CORRECTIONS_PENDING' })
    await expect(f.service.assessmentsWorkflow.approveAssessmentMarksCorrection({ requestId: 'self', correctionId: correction.id, expectedVersion: 0 })).rejects.toMatchObject({ code: 'MARKS_SELF_APPROVAL' })
    const decision = { requestId: 'approve', correctionId: correction.id, expectedVersion: 0 }
    await expect(f.reviewer.assessmentsWorkflow.approveAssessmentMarksCorrection({ ...decision, expectedVersion: 1 })).rejects.toMatchObject({ code: 'MARKS_CORRECTION_VERSION_CONFLICT' })
    expect((await f.reviewer.assessmentsWorkflow.approveAssessmentMarksCorrection(decision)).status).toBe('approved')
    await f.reviewer.assessmentsWorkflow.approveAssessmentMarksCorrection(decision)
    expect((await f.repositories.assessmentResults.findById('ar1'))!.revision).toBe(2)
    expect((await f.repositories.results.findById(draft.id))!.calculationStale).toBe(true)
    const regenerated = await f.service.assessmentsWorkflow.generateReportCardResult(reportInput)
    expect(regenerated.overallAverage).toBeUndefined()
    expect(regenerated.sectionResults[0]!.subResults[0]!.average).toBeUndefined()
    expect(regenerated.sectionResults[0]!.subResults[0]!.comment).toBe('Retain this comment')
    expect(regenerated.pendingCorrectionIds).toEqual([])
  })

  test('requires completeness, retains submission history, and denies stale/frozen writes', async () => {
    const f = await fixture()
    await f.repositories.assessmentResults.delete('ar1')
    await expect(f.service.assessmentsWorkflow.submitAssessmentMarks({ assessmentId: 'ass1', requestId: 'incomplete', expectedRevision: 0 })).rejects.toMatchObject({ code: 'MARKS_INCOMPLETE' })
    await f.service.assessmentsWorkflow.recordAssessmentResult({ requestId: 'absent', expectedRevision: 0, id: 'ar1', studentId: 'stu1', assessmentId: 'ass1', designation: 'absent' })
    const sheet = await f.service.assessmentsWorkflow.submitAssessmentMarks({ assessmentId: 'ass1', requestId: 'submit', expectedRevision: 1 })
    expect(sheet.marksReview.history.map(row => row.action)).toEqual(['submit'])
    await expect(f.edit(90, 0)).rejects.toMatchObject({ code: 'MARKS_REVISION_CONFLICT' })
    await expect(f.service.baseService.entities.assessments.delete('ass1')).rejects.toMatchObject({ code: 'ASSESSMENT_MARKS_FROZEN' })
    await expect(f.service.baseService.entities.assessments.batchDelete(['ass1'])).rejects.toMatchObject({ code: 'ASSESSMENT_MARKS_FROZEN' })
  })

  test('validates every proposal and rejects duplicates, no-ops, and a second pending batch', async () => {
    const f = await fixture()
    await f.edit()
    await f.service.assessmentsWorkflow.submitAssessmentMarks({ assessmentId: 'ass1', requestId: 'submit', expectedRevision: 1 })
    await expect(f.service.assessmentsWorkflow.requestAssessmentMarksCorrection(correctionInput(101))).rejects.toMatchObject({ code: 'SCORE_EXCEEDS_MAX_SCORE' })
    await expect(f.service.assessmentsWorkflow.requestAssessmentMarksCorrection(correctionInput(77.5))).rejects.toMatchObject({ code: 'MARKS_CORRECTION_UNCHANGED' })
    const input = correctionInput()
    await expect(f.service.assessmentsWorkflow.requestAssessmentMarksCorrection({ ...input, changes: [...input.changes, ...input.changes] })).rejects.toMatchObject({ code: 'DUPLICATE_ASSESSMENT_MARK' })
    const correction = await f.service.assessmentsWorkflow.requestAssessmentMarksCorrection(input)
    await expect(f.service.assessmentsWorkflow.requestAssessmentMarksCorrection({ ...input, requestId: 'another' })).rejects.toMatchObject({ code: 'MARKS_CORRECTION_PENDING' })
    await f.service.assessmentsWorkflow.withdrawAssessmentMarksCorrection({ correctionId: correction.id, requestId: 'withdraw', expectedVersion: 0 })
    const next = await f.service.assessmentsWorkflow.requestAssessmentMarksCorrection({ ...input, requestId: 'next' })
    await f.reviewer.assessmentsWorkflow.rejectAssessmentMarksCorrection({ correctionId: next.id, requestId: 'reject', expectedVersion: 0, reason: 'Original paper confirms the score' })
    expect((await f.repositories.assessmentResults.findById('ar1'))!.score).toBe(77.5)
    expect((await f.repositories.assessments.findById('ass1'))!.marksRevision).toBe(2)
    expect((await f.service.getAssessmentMarksReview({ assessmentId: 'ass1' })).corrections.map(row => row.status).sort()).toEqual(['rejected', 'withdrawn'])
  })

  test('independent student requests can be revised and approved without blocking each other', async () => {
    const f = await fixture()
    const assessment = (await f.repositories.assessments.findById('ass1'))!
    await f.repositories.assessments.save(new Assessment({ ...assessment.data, kind: AssessmentKind.Homework, dueAt: assessment.startsAt, startsAt: undefined, endsAt: undefined }))
    const student = (await f.repositories.students.findById('stu1'))!
    const enrollment = (await f.repositories.enrollments.findOne({ studentId: 'stu1', classGroupId: 'cg1' }))!
    await f.repositories.students.save(new Student({ ...student.data, id: 'stu2', subjectId: undefined }))
    await f.repositories.enrollments.save(new StudentClassEnrollment({ ...enrollment.data, id: 'enr2', studentId: 'stu2' }))
    await seedSubjectParticipation(f.repositories)
    await f.edit()
    await f.service.assessmentsWorkflow.recordAssessmentResult({ requestId: 'second-mark', expectedRevision: 1, id: 'ar2', studentId: 'stu2', assessmentId: 'ass1', score: 65 })
    await f.service.assessmentsWorkflow.submitAssessmentMarks({ assessmentId: 'ass1', requestId: 'submit-two', expectedRevision: 2 })
    const first = await f.service.assessmentsWorkflow.requestAssessmentMarksCorrection({ ...correctionInput(), expectedRevision: 3 })
    const second = await f.service.assessmentsWorkflow.requestAssessmentMarksCorrection({ ...correctionInput(), requestId: 'second-request', expectedRevision: 3, changes: [{ resultId: 'ar2', proposed: { score: 70, designation: 'scored', notes: null, status: DeadlineComplianceStatus.Late } }] })
    const revised = await f.service.assessmentsWorkflow.reviseAssessmentMarksCorrection({ ...correctionInput(88), requestId: 'revise-first', expectedRevision: 3, correctionId: first.id, expectedVersion: 0 })
    expect(revised.revisions).toHaveLength(1)
    expect(revised.revisions[0]!.changes[0]!.proposed.score).toBe(85)
    await expect(f.reviewer.assessmentsWorkflow.approveAssessmentMarksCorrection({ requestId: 'stale-review', correctionId: first.id, expectedVersion: 0 })).rejects.toMatchObject({ code: 'MARKS_CORRECTION_VERSION_CONFLICT' })
    await f.reviewer.assessmentsWorkflow.approveAssessmentMarksCorrection({ requestId: 'approve-first', correctionId: first.id, expectedVersion: revised.version })
    await f.reviewer.assessmentsWorkflow.approveAssessmentMarksCorrection({ requestId: 'approve-second', correctionId: second.id, expectedVersion: second.version })
    expect((await f.repositories.assessmentResults.findById('ar1'))!.score).toBe(88)
    expect((await f.repositories.assessmentResults.findById('ar2'))!.score).toBe(70)
    expect((await f.repositories.assessmentResults.findById('ar2'))!.status).toBe(DeadlineComplianceStatus.Late)
  })

  test('publication locks only the included student and leaves another student correctable', async () => {
    const f = await fixture()
    const student = (await f.repositories.students.findById('stu1'))!
    const enrollment = (await f.repositories.enrollments.findOne({ studentId: 'stu1', classGroupId: 'cg1' }))!
    await f.repositories.students.save(new Student({ ...student.data, id: 'stu2', subjectId: undefined }))
    await f.repositories.enrollments.save(new StudentClassEnrollment({ ...enrollment.data, id: 'enr2', studentId: 'stu2' }))
    await seedSubjectParticipation(f.repositories)
    await f.edit()
    await f.service.assessmentsWorkflow.recordAssessmentResult({ ...correctionInput(), id: 'ar2', studentId: 'stu2', expectedRevision: 1, score: 65 })
    await f.service.assessmentsWorkflow.submitAssessmentMarks({ assessmentId: 'ass1', requestId: 'submit', expectedRevision: 2 })
    const input = { ...correctionInput(), expectedRevision: 3, changes: [{ resultId: 'ar2', proposed: { score: 70, designation: 'scored' as const, notes: null } }] }
    const correction = await f.service.assessmentsWorkflow.requestAssessmentMarksCorrection(input)
    await f.service.assessmentsWorkflow.publishReportCardResult(reportInput)
    await f.reviewer.assessmentsWorkflow.approveAssessmentMarksCorrection({ correctionId: correction.id, requestId: 'approve', expectedVersion: 0 })
    expect((await f.repositories.assessmentResults.findById('ar1'))!.revision).toBe(1)
    expect((await f.repositories.assessmentResults.findById('ar2'))!.revision).toBe(2)
    expect((await f.service.getAssessmentMarksReview({ assessmentId: 'ass1' })).publishedResultIds).toEqual(['ar1'])
  })

  test('approval validates the entire batch before changing any official mark', async () => {
    const f = await fixture()
    await f.repositories.students.save(new Student({ ...(await f.repositories.students.findById('stu1'))!.data, id: 'stu2', subjectId: undefined }))
    await f.repositories.enrollments.save(new StudentClassEnrollment({ ...(await f.repositories.enrollments.findById('enr1'))!.data, id: 'enr2', studentId: 'stu2' }))
    await seedSubjectParticipation(f.repositories)
    await f.edit()
    await f.service.assessmentsWorkflow.recordAssessmentResult({ requestId: 'edit-two', assessmentId: 'ass1', id: 'ar2', studentId: 'stu2', expectedRevision: 1, score: 65 })
    await f.service.assessmentsWorkflow.submitAssessmentMarks({ assessmentId: 'ass1', requestId: 'submit', expectedRevision: 2 })
    const correction = await f.service.assessmentsWorkflow.requestAssessmentMarksCorrection({ ...correctionInput(), expectedRevision: 3, changes: [...correctionInput().changes, { resultId: 'ar2', proposed: { score: 70, designation: 'scored', notes: null } }] })
    const second = (await f.repositories.assessmentResults.findById('ar2'))!
    // Simulate a source revision conflict discovered at decision time.
    await f.repositories.assessmentResults.save(new AssessmentResult({ ...second.data, revision: second.revision + 1 }))
    const decision = { requestId: 'approve-batch', correctionId: correction.id, expectedVersion: 0 }
    await expect(f.reviewer.assessmentsWorkflow.approveAssessmentMarksCorrection(decision)).rejects.toMatchObject({ code: 'MARKS_REVISION_CONFLICT' })
    expect((await f.repositories.assessmentResults.findById('ar1'))!.score).toBe(77.5)
    expect((await f.repositories.marksCorrections.find('sch1', correction.id))!.status).toBe('pending')
    expect((await f.repositories.assessments.findById('ass1'))!.marksRevision).toBe(3)
    await f.repositories.assessmentResults.save(second)
    await f.reviewer.assessmentsWorkflow.approveAssessmentMarksCorrection(decision)
    expect((await f.repositories.assessmentResults.findById('ar1'))!.score).toBe(85)
    expect((await f.repositories.assessmentResults.findById('ar2'))!.score).toBe(70)
  })

  test('class scopes and tenant boundaries apply to correction reviews and queue counts', async () => {
    const f = await fixture()
    await f.edit()
    await f.service.assessmentsWorkflow.submitAssessmentMarks({ assessmentId: 'ass1', requestId: 'submit', expectedRevision: 1 })
    const correction = await f.service.assessmentsWorkflow.requestAssessmentMarksCorrection(correctionInput())
    await f.repositories.classGroups.save(new ClassGroup({ ...(await f.repositories.classGroups.findById('cg1'))!.data, id: 'unrelated-class' }))
    await f.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: Permission.GRADE_VALIDATE, schoolId: 'sch1', staffId: 'reviewer', academicYearId: 'ay1', permission: Permission.GRADE_VALIDATE, scopes: [{ kind: 'class_group', classGroupId: 'unrelated-class' }] }))
    const decision = { requestId: 'scope-review', correctionId: correction.id, expectedVersion: 0 }
    await expect(f.reviewer.assessmentsWorkflow.approveAssessmentMarksCorrection(decision)).rejects.toThrow()
    expect((await f.reviewer.listAssessmentMarksReviews({})).total).toBe(0)
    const foreign = f.forActor(createStaffActorMetadata({ schoolId: 'foreign-school', staffMemberId: 'reviewer', subjectId: 'reviewer-login', academicYearId: 'ay1', requestId: 'foreign', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified }))
    await expect(foreign.assessmentsWorkflow.approveAssessmentMarksCorrection(decision)).rejects.toThrow()
    expect((await f.repositories.marksCorrections.find('sch1', correction.id))!.status).toBe('pending')
  })

  test('a different correction author can be reviewed by the original submitter; queue counts respect scope', async () => {
    const f = await fixture()
    await f.edit()
    await f.service.assessmentsWorkflow.submitAssessmentMarks({ assessmentId: 'ass1', requestId: 'submit', expectedRevision: 1 })
    for (const permission of [Permission.GRADE_MANAGE, Permission.GRADE_MANAGE])
      await f.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: `edit-${permission}`, schoolId: 'sch1', staffId: 'reviewer', academicYearId: 'ay1', permission, scopes: [{ kind: 'class_group', classGroupId: 'cg1' }] }))
    const correction = await f.reviewer.assessmentsWorkflow.requestAssessmentMarksCorrection(correctionInput())
    expect((await f.reviewer.listAssessmentMarksReviews({})).items[0]!.allowedActions.approve).toBe(false)
    expect((await f.service.listAssessmentMarksReviews({})).total).toBe(1)
    await expect(f.family.listAssessmentMarksReviews({})).rejects.toThrow()
    await expect(f.reviewer.assessmentsWorkflow.approveAssessmentMarksCorrection({ requestId: 'self', correctionId: correction.id, expectedVersion: 0 })).rejects.toMatchObject({ code: 'MARKS_SELF_APPROVAL' })
    await f.service.assessmentsWorkflow.approveAssessmentMarksCorrection({ requestId: 'original-submitter', correctionId: correction.id, expectedVersion: 0 })
    expect((await f.repositories.assessmentResults.findById('ar1'))!.score).toBe(85)
    expect((await f.reviewer.listAssessmentMarksReviews({})).total).toBe(0)
  })

  test('correction queue pages and counts beyond 51 and 501 rows', async () => {
    const f = await fixture()
    await f.edit()
    await f.service.assessmentsWorkflow.submitAssessmentMarks({ assessmentId: 'ass1', requestId: 'submit', expectedRevision: 1 })
    const correction = await f.service.assessmentsWorkflow.requestAssessmentMarksCorrection(correctionInput())
    await f.service.assessmentsWorkflow.withdrawAssessmentMarksCorrection({ requestId: 'withdraw', correctionId: correction.id, expectedVersion: 0 })
    // Persist resolved historical records to exercise SQL pagination without hundreds of workflow transitions.
    for (let index = 0; index < 501; index++) await f.repositories.marksCorrections.save({ ...correction, id: `history-${String(index).padStart(4, '0')}`, status: 'rejected', version: 1, decidedBy: 'reviewer-login', decidedAt: new Date(), rejectionReason: 'Fixture history' })
    const page = await f.reviewer.listAssessmentMarksReviews({ status: 'rejected', offset: 500, limit: 100 })
    expect(page.total).toBe(501)
    expect(page.items).toHaveLength(1)
    expect(page.items[0]!.correction.id).toBe('history-0500')
    expect((await f.reviewer.listAssessmentMarksReviews({ status: 'rejected', offset: 50, limit: 1000 })).items).toHaveLength(100)
  })

  test('prevents direct review-field mutation and invalid scoring edits while allowing completion', async () => {
    const f = await fixture()
    const current = (await f.repositories.assessments.findById('ass1'))!
    await expect(f.service.baseService.entities.assessments.save(new Assessment({ ...current.data, marksStatus: 'submitted' }))).rejects.toMatchObject({ code: 'MARKS_STATE_COMMAND_REQUIRED' })
    await expect(f.service.baseService.entities.assessments.save(new Assessment({ ...current.data, maxScore: 50 }))).rejects.toMatchObject({ code: 'SCORE_EXCEEDS_MAX_SCORE' })
    await f.service.assessmentsWorkflow.completeAssessment({ assessmentId: 'ass1' })
    expect((await f.repositories.assessments.findById('ass1'))?.completedAt).toBeDefined()
  })
})
