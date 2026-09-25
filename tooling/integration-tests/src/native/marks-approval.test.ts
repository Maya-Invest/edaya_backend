import { ActorAssuranceLevel, createGuardianActorMetadata, createTeacherActorMetadata } from '@edaya/authorization'
import { Guardian, GuardianStudentLink, ReportCardResultStatus, Teacher, TeacherAssignment, TeacherAssignmentKind } from '@edaya/core'
import { expect, test } from 'bun:test'
import { fixture } from './support/marks-fixture'

test('native edit versus submission serializes one inspected revision and retains rejected edits', async () => {
  const f = await fixture('marks-race')
  await f.editor.assessmentsWorkflow.recordAssessmentResult(f.edit('first', 0))
  const outcomes = await Promise.allSettled([
    f.editor.assessmentsWorkflow.recordAssessmentResult(f.edit('next', 1, 14.25)),
    f.other.assessmentsWorkflow.submitAssessmentMarks(f.command('submit', 1)),
  ])
  expect(outcomes.filter(item => item.status === 'fulfilled')).toHaveLength(1)
  expect(outcomes.filter(item => item.status === 'rejected')).toHaveLength(1)
  const state = (await f.r.assessments.findById(f.id('assessment')))!
  expect(state.marksRevision).toBe(2)
  const score = (await f.r.assessmentResults.findById(f.id('mark')))!.score
  expect(score).toBe(state.marksStatus === 'submitted' ? 12.75 : 14.25)
}, 30000)

test('native concurrent publication uses the existing draft, one issuance and blocks reopening', async () => {
  const f = await fixture('marks-publish')
  await f.editor.assessmentsWorkflow.recordAssessmentResult(f.edit('first', 0))
  await f.editor.assessmentsWorkflow.submitAssessmentMarks(f.command('submit', 1))
  await f.reviewer.assessmentsWorkflow.approveAssessmentMarks(f.command('approve', 2))
  await f.editor.assessmentsWorkflow.generateReportCardResult(f.report)
  const reports = await Promise.all([
    f.editor.assessmentsWorkflow.publishReportCardResult({ ...f.report, id: f.id('request-a') }),
    f.other.assessmentsWorkflow.publishReportCardResult({ ...f.report, id: f.id('request-b') }),
  ])
  expect(reports.map(report => report.id)).toEqual([f.report.id, f.report.id])
  expect(reports[0]!.overallAverage).toBe(12.75)
  expect(await f.r.results.count({ studentId: f.report.studentId, status: ReportCardResultStatus.Published })).toBe(1)
  expect(await f.r.documentIssuances.count({ schoolId: f.id('school') })).toBe(1)
  await expect(f.reviewer.assessmentsWorkflow.returnAssessmentMarks({ ...f.command('return', 3), reason: 'Correction' })).rejects.toMatchObject({ code: 'PUBLISHED_REPORT_CARD_IMMUTABLE' })
  const projection = await f.editor.getSchoolOverview({ schoolId: f.id('school'), academicYearId: f.id('year'), academicPeriodId: f.id('period'), referenceDate: new Date('2026-02-02') })
  expect(projection.kpis.studentCount).toBe(1)
  expect(projection.kpis.publishedReportCardCount).toBe(1)
  expect(projection.areaHealth.academics.gradingCompletionPercent).toBe(100)
  expect((await f.editor.getAppShellCounts({ schoolId: f.id('school'), classGroupIds: [f.id('class')] })).activeEnrollmentCountsByClass).toEqual({ [f.id('class')]: 1 })
}, 30000)

test('native return versus publication leaves a published dependency approved or publication rejected', async () => {
  const f = await fixture('marks-return')
  await f.editor.assessmentsWorkflow.recordAssessmentResult(f.edit('first', 0))
  await f.editor.assessmentsWorkflow.submitAssessmentMarks(f.command('submit', 1))
  await f.reviewer.assessmentsWorkflow.approveAssessmentMarks(f.command('approve', 2))
  const outcomes = await Promise.allSettled([
    f.editor.assessmentsWorkflow.publishReportCardResult(f.report),
    f.reviewer.assessmentsWorkflow.returnAssessmentMarks({ ...f.command('return', 3), reason: 'Correction' }),
  ])
  expect(outcomes.filter(item => item.status === 'fulfilled')).toHaveLength(1)
  const sheet = (await f.r.assessments.findById(f.id('assessment')))!
  const published = await f.r.results.count({ studentId: f.report.studentId, status: ReportCardResultStatus.Published })
  expect(published).toBe(sheet.marksStatus === 'approved' ? 1 : 0)
}, 30000)

test('native teacher to independent reviewer to family and publication journey', async () => {
  const f = await fixture('marks-journey')
  await f.r.teachers.save(new Teacher({ id: f.id('teacher'), schoolId: f.id('school'), subjectId: f.id('editor'), firstName: 'Teacher', lastName: 'Editor' }))
  await f.r.teacherAssignments.save(new TeacherAssignment({ id: f.id('teaching'), teacherId: f.id('teacher'), academicYearId: f.id('year'), kind: TeacherAssignmentKind.Subject, classSubjectId: f.id('subject') }))
  await f.r.guardians.save(new Guardian({ id: f.id('guardian'), schoolId: f.id('school'), subjectId: f.id('family'), firstName: 'Family', lastName: 'Guardian' }))
  await f.r.guardianLinks.save(new GuardianStudentLink({ id: f.id('family-link'), schoolId: f.id('school'), guardianId: f.id('guardian'), studentId: f.id('student'), receivesAcademicReports: true }))
  const actor = { schoolId: f.id('school'), academicYearId: f.id('year'), requestId: f.id('journey'), authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified }
  const teacher = f.application.forActor(createTeacherActorMetadata({ ...actor, teacherId: f.id('teacher'), subjectId: f.id('editor') }))
  const family = f.application.forActor(createGuardianActorMetadata({ ...actor, guardianId: f.id('guardian'), subjectId: f.id('family') }))
  await teacher.assessmentsWorkflow.recordAssessmentResult(f.edit('teacher-edit', 0))
  expect(await family.baseService.entities.assessmentResults.count()).toBe(0)
  expect(f.gateway.enqueued).toHaveLength(0)
  await teacher.assessmentsWorkflow.submitAssessmentMarks(f.command('teacher-submit', 1))
  // The same identity also owns the school through its staff profile.
  await expect(f.editor.assessmentsWorkflow.approveAssessmentMarks(f.command('owner-self-review', 2))).rejects.toMatchObject({ code: 'MARKS_SELF_APPROVAL' })
  await f.reviewer.assessmentsWorkflow.approveAssessmentMarks(f.command('independent-review', 2))
  expect(await family.baseService.entities.assessmentResults.count()).toBe(1)
  expect((await family.baseService.entities.assessmentResults.list({ $limit: 1 }))[0]!.score).toBe(12.75)
  expect(f.gateway.enqueued.length).toBeGreaterThan(0)
  const report = await f.editor.assessmentsWorkflow.publishReportCardResult(f.report)
  expect(report.overallAverage).toBe(12.75)
  expect((await family.baseService.entities.results.findById(report.id))!.status).toBe(ReportCardResultStatus.Published)
}, 30000)
