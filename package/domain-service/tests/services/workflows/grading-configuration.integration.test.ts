import { ActorAssuranceLevel, createStaffActorMetadata } from '@edaya/authorization'
import { AcademicYear, Assessment, GradeScale, Permission, ReportCardResultStatus, StaffMember, StaffPermissionAssignment } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { dispatchGradingRecalculation } from '../../../src/capabilities/academics/durable-grading'
import { applyReportCommentRevision } from '../../../src/capabilities/academics/report-comment-revisions'
import { seedSubjectParticipation } from '../../support/seed-subject-participation'
import { createReportCardContext } from './report-card-workflow-context'

async function fixture(published = false) {
  const f = await createReportCardContext()
  const year = (await f.repositories.academicYears.findById('ay1'))!
  await f.repositories.academicYears.save(new AcademicYear({ ...year.data, startDate: new Date('2020-01-01'), endDate: new Date('2099-12-31') }))
  const scale = new GradeScale({ id: 'points', schoolId: 'sch1', name: 'Points', minScore: 0, maxScore: 4, intervalConvention: 'continuous', decimalPlaces: 2, ranges: [
    { id: 'f', letter: 'F', interpretation: 'Fail', minScore: 0, maxScore: 2, gpaValue: 0 },
    { id: 'b', letter: 'B', interpretation: 'Good', minScore: 2, maxScore: 3.5, gpaValue: 3 },
    { id: 'a', letter: 'A', interpretation: 'Excellent', minScore: 3.5, maxScore: 4, gpaValue: 4 },
  ] })
  await f.repositories.gradeScales.save(scale)
  const report = { id: 'rc1', studentId: 'stu1', periodId: 'per1' }
  const draft = await f.service.assessmentsWorkflow.generateReportCardResult(report)
  if (published)
    await f.service.assessmentsWorkflow.publishReportCardResult({ ...report, reviewedDraftVersion: draft.version, reviewedGradingRevision: draft.gradingPolicyRevision, reviewedReportConfigurationRevision: draft.reportConfigurationRevision })
  const input = { requestId: 'grading-1', gradeLevelId: 'grade1', academicYearId: 'ay1', scaleId: scale.id, mode: 'numeric-first' as const, aggregateLabel: 'Moyenne', expectedRevision: 1, confirmed: true }
  const policy = async () => (await f.repositories.gradeLevels.findById('grade1'))!.gradingPolicyFor('ay1')!
  const drain = async () => {
    for (let attempt = 0; attempt < 30; attempt++) {
      const result = await dispatchGradingRecalculation(f.application)
      expect(result.failed).toBe(0)
      if ((await policy()).status === 'completed')
        return
    }
    throw new Error('Recalculation did not finish')
  }
  return { ...f, input, report, policy, drain }
}

describe('grading configuration updates', () => {
  test('requires confirmation, queues durable batches, preserves numeric entries and legacy years', async () => {
    const f = await fixture()
    await expect(f.service.assessmentsWorkflow.configureGrading({ ...f.input, confirmed: false })).rejects.toMatchObject({ code: 'GRADING_CONFIRMATION_REQUIRED' })
    await f.service.assessmentsWorkflow.configureGrading(f.input)
    expect((await f.policy()).status).toBe('updating')
    await expect(f.service.assessmentsWorkflow.publishReportCardResult(f.report)).rejects.toMatchObject({ code: 'REPORT_REVIEW_REQUIRED' })
    await f.drain()
    const mark = (await f.repositories.assessmentResults.findById('ar1'))!
    expect(mark.score).toBe(80)
    expect(mark.revision).toBe(0)
    expect(mark.calculation?.value).toBe(3.2)
    expect((await f.results.findById('rc1'))?.overallAverage).toBe(3.2)
    expect((await f.policy()).status).toBe('completed')
    await expect(f.service.assessmentsWorkflow.configureGrading({ ...f.input, requestId: 'historic', academicYearId: 'ay2' })).rejects.toMatchObject({ code: 'GRADING_CURRENT_YEAR_REQUIRED' })
  })
  test('retains a published result until its revised draft is explicitly reviewed and republished', async () => {
    const f = await fixture(true)
    await f.service.assessmentsWorkflow.configureGrading(f.input)
    await f.drain()
    const original = (await f.results.findById('rc1'))!
    expect(original.status).toBe(ReportCardResultStatus.Published)
    expect(original.overallAverage).toBe(16)
    expect(original.revisedDraft?.overallAverage).toBe(3.2)
    await expect(f.service.assessmentsWorkflow.publishReportCardResult({ ...f.report, id: 'unreviewed' })).rejects.toMatchObject({ code: 'GRADING_REVIEW_REQUIRED' })
    const published = await f.service.assessmentsWorkflow.publishReportCardResult({ ...f.report, reviewedGradingRevision: 2, reviewedReportConfigurationRevision: 0, reviewedDraftVersion: original.revisedDraft!.version })
    expect(published.overallAverage).toBe(3.2)
    expect(published.publicationHistory[0]?.overallAverage).toBe(16)
    expect(published.revisedDraft).toBeUndefined()
  })
  test('label-only saves do not queue work; a superseding configuration wins', async () => {
    const f = await fixture()
    await f.service.assessmentsWorkflow.configureGrading(f.input)
    await f.service.assessmentsWorkflow.configureGrading({ ...f.input, requestId: 'label', expectedRevision: 2, aggregateLabel: 'GPA', confirmed: false })
    expect((await f.policy()).revision).toBe(2)
    expect((await f.policy()).aggregateLabel).toBe('GPA')
    await f.service.assessmentsWorkflow.configureGrading({ ...f.input, requestId: 'newer', expectedRevision: 2, mode: 'mention-first' })
    await f.drain()
    expect((await f.policy()).revision).toBe(3)
    expect((await f.repositories.assessmentResults.findById('ar1'))?.calculation?.policyRevision).toBe(3)
  })
  test('captures mention entries and requires mappings before converting them', async () => {
    const f = await fixture()
    const assessment = (await f.repositories.assessments.findById('ass1'))!
    await f.repositories.assessments.save(new Assessment({ ...assessment.data, marksStatus: 'draft' }))
    await f.service.assessmentsWorkflow.configureGrading({ ...f.input, mode: 'mention-first' })
    await f.drain()
    const mark = await f.service.assessmentsWorkflow.recordAssessmentResult({ id: 'ar1', studentId: 'stu1', assessmentId: 'ass1', requestId: 'mention', expectedRevision: 0, designation: 'scored', mentionId: 'b' })
    expect(mark.score).toBeUndefined()
    expect(mark.originalEntry?.kind).toBe('mention')
    expect(mark.calculation?.value).toBe(3)
    await expect(f.service.assessmentsWorkflow.configureGrading({ ...f.input, requestId: 'numeric', expectedRevision: 2 })).rejects.toMatchObject({ code: 'GRADING_NUMERIC_EQUIVALENT_REQUIRED' })
    await f.service.assessmentsWorkflow.configureGrading({ ...f.input, requestId: 'numeric', expectedRevision: 2, numericEquivalents: { '2:f': 0, '2:b': 2.8, '2:a': 4 } })
    await f.drain()
    const after = (await f.repositories.assessmentResults.findById('ar1'))!
    expect(after.originalEntry).toEqual(mark.originalEntry)
    expect(after.calculation?.value).toBe(2.8)
  })
})

test('a failed page retries from its cursor without duplicating a published revision', async () => {
  const f = await fixture(true)
  await f.service.assessmentsWorkflow.configureGrading(f.input)
  const resultStore = f.repositories.results
  const originalList = resultStore.list.bind(resultStore)
  let interrupted = false
  resultStore.list = async (...args) => {
    if (!interrupted && (await f.policy()).cursor?.phase === 'reports') {
      interrupted = true
      throw new Error('private provider detail must not be exposed')
    }
    return originalList(...args)
  }
  for (let attempt = 0; attempt < 15; attempt++) {
    await dispatchGradingRecalculation(f.application)
    if (interrupted)
      break
  }
  resultStore.list = originalList
  expect((await f.policy()).status).toBe('failed')
  expect((await f.policy()).failureCode).toBe('GRADING_UPDATE_FAILED')
  await f.service.assessmentsWorkflow.retryGrading({ requestId: 'retry', gradeLevelId: 'grade1', academicYearId: 'ay1', expectedRevision: 2 })
  await f.drain()
  const result = (await f.results.findById('rc1'))!
  expect(result.revisedDraft?.overallAverage).toBe(3.2)
  expect(result.publicationHistory).toHaveLength(0)
  expect(result.overallAverage).toBe(16)
})

test('a queued mark entered using an older policy revision is rejected', async () => {
  const f = await fixture()
  const assessment = (await f.repositories.assessments.findById('ass1'))!
  await f.repositories.assessments.save(new Assessment({ ...assessment.data, marksStatus: 'draft' }))
  await f.service.assessmentsWorkflow.configureGrading({ ...f.input, mode: 'mention-first' })
  await expect(f.service.assessmentsWorkflow.recordAssessmentResult({ id: 'ar1', studentId: 'stu1', assessmentId: 'ass1', requestId: 'old-offline', expectedRevision: 0, expectedGradingRevision: 0, score: 90 })).rejects.toMatchObject({ code: 'GRADING_REVISION_CONFLICT' })
  expect((await f.repositories.assessmentResults.findById('ar1'))?.score).toBe(80)
})

test('teacher edits between report and ranking batches are retained and recalculated', async () => {
  const f = await fixture(true)
  await f.service.assessmentsWorkflow.configureGrading(f.input)
  for (let attempt = 0; attempt < 15 && (await f.policy()).cursor?.phase !== 'rankings'; attempt++) await dispatchGradingRecalculation(f.application)
  const { AssessmentResult } = await import('@edaya/core')
  const original = (await f.repositories.assessmentResults.findById('ar1'))!
  // Simulate the atomic outcome of an approved correction between worker pages.
  await f.repositories.assessmentResults.save(new AssessmentResult({ ...original.data, score: 90, originalEntry: { kind: 'numeric', value: 90, maximum: 100 }, revision: original.revision + 1 }))
  await f.repositories.assessmentDependencies.invalidateMarkDrafts('sch1', ['ar1'])
  expect((await f.results.findById('rc1'))?.revisedDraft?.calculationStale).toBe(true)
  await f.drain()
  const result = (await f.results.findById('rc1'))!
  expect(result.revisedDraft?.overallAverage).toBe(3.6)
  expect(result.revisedDraft?.rank).toBe(1)
  expect(result.overallAverage).toBe(16)
  expect((await f.repositories.assessmentResults.findById('ar1'))?.originalEntry).toEqual({ kind: 'numeric', value: 90, maximum: 100 })
})

test('annual drafts use recalculated terms and retain publication prerequisites', async () => {
  const f = await fixture(true)
  const { AcademicPeriod, AcademicPeriodType, ReportCardAggregationSource } = await import('@edaya/core')
  await f.repositories.academicPeriods.save(new AcademicPeriod({ id: 'annual', schoolId: 'sch1', academicYearId: 'ay1', name: 'Annual', type: AcademicPeriodType.Other, isPublished: true, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') }))
  const annual = { ...f.report, id: 'annual-report', periodId: 'annual', aggregation: { source: ReportCardAggregationSource.ReportCards, sourcePeriodIds: ['per1'] } }
  const annualDraft = await f.service.assessmentsWorkflow.generateReportCardResult(annual)
  await f.service.assessmentsWorkflow.publishReportCardResult({ ...annual, reviewedDraftVersion: annualDraft.version, reviewedGradingRevision: annualDraft.gradingPolicyRevision, reviewedReportConfigurationRevision: annualDraft.reportConfigurationRevision })
  await f.service.assessmentsWorkflow.configureGrading(f.input)
  await f.drain()
  const revised = (await f.results.findById('annual-report'))!
  expect(revised.overallAverage).toBe(16)
  expect(revised.revisedDraft?.overallAverage).toBe(3.2)
  await expect(f.service.assessmentsWorkflow.publishReportCardResult({ ...annual, reviewedGradingRevision: 2, reviewedReportConfigurationRevision: 0, reviewedDraftVersion: revised.revisedDraft!.version })).rejects.toMatchObject({ code: 'AGGREGATED_REPORT_CARD_SOURCES_NOT_READY' })
  const term = (await f.results.findById('rc1'))!
  await f.service.assessmentsWorkflow.publishReportCardResult({ ...f.report, reviewedGradingRevision: 2, reviewedReportConfigurationRevision: 0, reviewedDraftVersion: term.revisedDraft!.version })
  const retained = await f.service.baseService.access.reportCards.annualDocumentContext('annual-report')
  expect(retained.contributors[0]?.result.overallAverage).toBe(16)
  // Regeneration refreshes provenance after the contributing report's republication.
  const regenerated = await f.service.assessmentsWorkflow.generateReportCardResult(annual)
  expect(regenerated.revisedDraft?.rank).toBe(1)
  const published = await f.service.assessmentsWorkflow.publishReportCardResult({ ...annual, reviewedGradingRevision: 2, reviewedReportConfigurationRevision: 0, reviewedDraftVersion: regenerated.revisedDraft!.version })
  expect(published.overallAverage).toBe(3.2)
  expect(published.rank).toBe(1)
  expect(published.publicationHistory).toHaveLength(1)
})

test('a prior published comment correction cannot hide the first grading revised draft', async () => {
  const f = await fixture(true)
  const previous = (await f.results.findById('rc1'))!
  await f.service.assessmentsWorkflow.configureGrading(f.input)
  await f.drain()
  const updated = (await f.results.findById('rc1'))!
  const visible = applyReportCommentRevision(updated, { ...previous.data, teacherComment: 'Reviewed comment' })
  expect(visible.teacherComment).toBe('Reviewed comment')
  expect(visible.overallAverage).toBe(16)
  expect(visible.revisedDraft?.overallAverage).toBe(3.2)
  expect(visible.revisedDraft?.version).toBe(updated.revisedDraft!.version)
})

test('an absent-to-numeric correction preserves the full entered precision', async () => {
  const f = await fixture()
  const { AssessmentResult } = await import('@edaya/core')
  await f.repositories.assessmentResults.save(new AssessmentResult({ id: 'ar1', studentId: 'stu1', assessmentId: 'ass1', designation: 'absent' }))
  await f.service.assessmentsWorkflow.configureGrading(f.input)
  await f.drain()
  const correction = await f.service.assessmentsWorkflow.requestAssessmentMarksCorrection({ requestId: 'precise', assessmentId: 'ass1', expectedRevision: 0, expectedGradingRevision: 2, reason: 'Original paper recovered', changes: [{ resultId: 'ar1', proposed: { score: 73.123, designation: 'scored', notes: null } }] })
  expect(correction.changes[0]!.proposed.score).toBe(73.123)
  const revised = await f.service.assessmentsWorkflow.reviseAssessmentMarksCorrection({ requestId: 'more-precise', correctionId: correction.id, expectedVersion: 0, assessmentId: 'ass1', expectedRevision: 0, expectedGradingRevision: 2, reason: 'Checked the total', changes: [{ resultId: 'ar1', proposed: { score: 74.567, designation: 'scored', notes: null } }] })
  expect(revised.changes[0]!.proposed.score).toBe(74.567)
  await f.repositories.staffMembers.save(new StaffMember({ id: 'reviewer', schoolId: 'sch1', firstName: 'Review', lastName: 'Staff', subjectId: 'reviewer-login' }))
  await f.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'validate', schoolId: 'sch1', staffId: 'reviewer', academicYearId: 'ay1', permission: Permission.GRADE_VALIDATE, scopes: [{ kind: 'class_group', classGroupId: 'cg1' }] }))
  const reviewer = f.forActor(createStaffActorMetadata({ schoolId: 'sch1', staffMemberId: 'reviewer', subjectId: 'reviewer-login', academicYearId: 'ay1', requestId: 'reviewer', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified }))
  await reviewer.assessmentsWorkflow.approveAssessmentMarksCorrection({ requestId: 'approve-precise', correctionId: revised.id, expectedVersion: revised.version })
  const mark = (await f.repositories.assessmentResults.findById('ar1'))!
  expect(mark.score).toBe(74.567)
  expect(mark.originalEntry).toEqual({ kind: 'numeric', value: 74.567, maximum: 100 })
  expect(mark.calculation?.value).toBeCloseTo(2.98268)
})

test('mark recalculation is bounded and keeps precise teacher entries', async () => {
  const f = await fixture()
  const { Student, AssessmentResult } = await import('@edaya/core')
  const student = (await f.repositories.students.findById('stu1'))!
  for (let index = 0; index < 55; index++) {
    const id = `batch-${String(index).padStart(3, '0')}`
    await f.repositories.students.save(new Student({ ...student.data, id, subjectId: undefined, matricule: undefined }))
    await f.repositories.assessmentResults.save(new AssessmentResult({ id, studentId: id, assessmentId: 'ass1', score: 73.123, originalEntry: { kind: 'numeric', value: 73.123, maximum: 100 } }))
  }
  await f.service.assessmentsWorkflow.configureGrading(f.input)
  await dispatchGradingRecalculation(f.application)
  const first = await f.repositories.assessmentResults.list({ assessmentId: 'ass1' })
  expect(first.filter(row => row.calculation)).toHaveLength(50)
  expect((await f.policy()).status).toBe('updating')
  await f.drain()
  const last = (await f.repositories.assessmentResults.findById('batch-054'))!
  expect(last.score).toBe(73.123)
  expect(last.calculation?.value).toBeCloseTo(2.92492, 10)
  expect(last.calculation?.reportedValue).toBe(2.92)
})

test('an exhausted crashed page is visible as failed and can resume', async () => {
  const f = await fixture()
  await f.service.assessmentsWorkflow.configureGrading(f.input)
  const store = f.application.durableWork
  const getState = store.getState.bind(store)
  store.getState = async () => ({ status: 'dead', retryAt: null })
  const visible = await f.service.baseService.entities.gradeLevels.findById('grade1')
  expect(visible?.gradingPolicyFor('ay1')?.status).toBe('failed')
  await f.service.setupWorkflow.configureGradeLevel({ ...visible!.data, name: 'Renamed level' })
  expect((await f.policy()).status).toBe('updating')
  expect((await f.repositories.gradeLevels.findById('grade1'))?.name).toBe('Renamed level')
  store.getState = getState
  await f.service.assessmentsWorkflow.retryGrading({ requestId: 'after-crash', gradeLevelId: 'grade1', academicYearId: 'ay1', expectedRevision: 2 })
  await f.drain()
})

test('changing scale identity creates a revision and rejects a stale scale editor', async () => {
  const f = await fixture()
  await f.service.assessmentsWorkflow.configureGrading(f.input)
  const scale = (await f.repositories.gradeScales.findById('points'))!
  await f.repositories.gradeScales.save(new GradeScale({ ...scale.data, id: 'alternate', ranges: [...scale.ranges] }))
  await expect(f.service.assessmentsWorkflow.configureGrading({ ...f.input, requestId: 'stale-scale', expectedRevision: 2, expectedScaleRevision: 5 })).rejects.toMatchObject({ code: 'GRADING_REVISION_CONFLICT' })
  await f.service.assessmentsWorkflow.configureGrading({ ...f.input, requestId: 'alternate', expectedRevision: 2, scaleId: 'alternate', expectedScaleRevision: 0 })
  await f.drain()
  expect((await f.policy()).revision).toBe(3)
  expect((await f.policy()).scale.id).toBe('alternate')
  expect((await f.results.findById('rc1'))?.grading?.scaleId).toBe('alternate')
})

test('staff correction details resolve mention identifiers using the reviewed grading revision', async () => {
  const f = await fixture()
  const sheet = (await f.repositories.assessments.findById('ass1'))!
  await f.repositories.assessments.save(new Assessment({ ...sheet.data, marksStatus: 'draft' }))
  await f.service.assessmentsWorkflow.configureGrading({ ...f.input, mode: 'mention-first' })
  await f.drain()
  await f.service.assessmentsWorkflow.recordAssessmentResult({ id: 'ar1', studentId: 'stu1', assessmentId: 'ass1', requestId: 'entry', expectedRevision: 0, designation: 'scored', mentionId: 'b' })
  await f.service.assessmentsWorkflow.submitAssessmentMarks({ assessmentId: 'ass1', requestId: 'submit', expectedRevision: 1 })
  const correction = await f.service.assessmentsWorkflow.requestAssessmentMarksCorrection({ requestId: 'mention-correction', assessmentId: 'ass1', expectedRevision: 2, expectedGradingRevision: 2, reason: 'Checked original work', changes: [{ resultId: 'ar1', proposed: { mentionId: 'a', score: null, designation: 'scored', notes: null } }] })
  const scale = (await f.repositories.gradeScales.findById('points'))!
  await f.repositories.gradeScales.save(new GradeScale({ ...scale.data, ranges: scale.ranges.map(range => ({ ...range, letter: `New ${range.letter}` })) }))
  await f.service.assessmentsWorkflow.configureGrading({ ...f.input, requestId: 'new-labels', expectedRevision: 2, mode: 'mention-first' })
  const detail = await f.service.teacherCorrectionsWorkflow.detail({ correctionId: correction.id })
  expect(detail.original).toMatchObject({ mentionLabels: { b: 'B · Good', a: 'A · Excellent' } })
})

test('ranking a later draft never rewrites an already published ranking', async () => {
  const f = await fixture()
  const { AssessmentResult, Student, StudentClassEnrollment } = await import('@edaya/core')
  const student = (await f.repositories.students.findById('stu1'))!
  const enrollment = (await f.repositories.enrollments.findById('enr1'))!
  const assessment = (await f.repositories.assessments.findById('ass1'))!
  await f.repositories.students.save(new Student({ ...student.data, id: 'stu2', subjectId: undefined }))
  await f.repositories.enrollments.save(new StudentClassEnrollment({ ...enrollment.data, id: 'enr2', studentId: 'stu2' }))
  await seedSubjectParticipation(f.repositories)
  await f.repositories.assessments.save(new Assessment({ ...assessment.data, marksReview: { ...assessment.marksReview, rosterStudentIds: ['stu1', 'stu2'] } }))
  await f.repositories.assessmentResults.save(new AssessmentResult({ id: 'ar2', studentId: 'stu2', assessmentId: 'ass1', score: 90 }))
  await f.service.assessmentsWorkflow.configureGrading(f.input)
  await f.drain()
  const draft = (await f.repositories.results.findById(f.report.id))!
  const published = await f.service.assessmentsWorkflow.publishReportCardResult({ ...f.report, reviewedDraftVersion: draft.version, reviewedGradingRevision: draft.gradingPolicyRevision, reviewedReportConfigurationRevision: draft.reportConfigurationRevision })
  expect(published.rank).toBe(1)
  const next = await f.service.assessmentsWorkflow.generateReportCardResult({ ...f.report, id: 'rc2', studentId: 'stu2' })
  expect(next.rank).toBe(1)
  expect(next.classSize).toBe(2)
  expect(next.sectionResults[0]?.rank).toBe(1)
  expect(next.sectionResults[0]?.participantCount).toBe(2)
  expect(next.sectionResults[0]?.subResults[0]?.participantCount).toBe(2)
  const retained = (await f.repositories.results.findById('rc1'))!
  expect(retained.rank).toBe(published.rank)
  expect(retained.classSize).toBe(published.classSize)
  expect(retained.sectionResults[0]?.participantCount).toBe(1)
})


test('section ranking changes invalidate review and stale section ranks are hidden', async () => {
  const f = await fixture()
  const { AssessmentResult, Student, StudentClassEnrollment, ReportCardResult } = await import('@edaya/core')
  const first = (await f.results.findById('rc1'))!
  const student = (await f.repositories.students.findById('stu1'))!
  const enrollment = (await f.repositories.enrollments.findById('enr1'))!
  const assessment = (await f.repositories.assessments.findById('ass1'))!
  await f.repositories.students.save(new Student({ ...student.data, id: 'stu2', subjectId: undefined }))
  await f.repositories.enrollments.save(new StudentClassEnrollment({ ...enrollment.data, id: 'enr2', studentId: 'stu2' }))
  await seedSubjectParticipation(f.repositories)
  await f.repositories.assessments.save(new Assessment({ ...assessment.data, marksReview: { ...assessment.marksReview, rosterStudentIds: ['stu1', 'stu2'] } }))
  await f.repositories.assessmentResults.save(new AssessmentResult({ id: 'ar2', studentId: 'stu2', assessmentId: 'ass1', score: 90 }))
  await f.service.assessmentsWorkflow.generateReportCardResult({ ...f.report, id: 'rc2', studentId: 'stu2' })
  const updated = (await f.results.findById('rc1'))!
  expect(updated.version).toBeGreaterThan(first.version)
  expect(updated.sectionResults[0]?.rank).toBe(2)
  await expect(f.service.assessmentsWorkflow.publishReportCardResult({ ...f.report, reviewedDraftVersion: first.version, reviewedGradingRevision: first.gradingPolicyRevision, reviewedReportConfigurationRevision: first.reportConfigurationRevision })).rejects.toMatchObject({ code: 'REPORT_REVIEW_REQUIRED' })
  await f.results.save(new ReportCardResult({ ...updated.data, sectionResults: [...updated.sectionResults], calculationStale: true }))
  const visible = (await f.service.baseService.entities.results.findById('rc1'))!
  expect(visible.sectionResults[0]?.rank).toBeUndefined()
  expect(visible.sectionResults[0]?.subResults[0]?.participantCount).toBeUndefined()
})
