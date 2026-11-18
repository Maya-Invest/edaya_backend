import { ActorAssuranceLevel, createGuardianActorMetadata } from '@edaya/authorization'
import { AcademicPeriod, AcademicPeriodType, Assessment, AssessmentResult, GradeLevel, ReportCardAggregationSource, ReportCardResultStatus, withShortName } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { createReportCardContext } from './report-card-workflow-context'

async function fixture(options: Parameters<typeof createReportCardContext>[0] = {}) {
  const f = await createReportCardContext(options)
  const guardian = f.forActor(createGuardianActorMetadata({ schoolId: 'sch1', academicYearId: 'ay1', guardianId: 'gua1', subjectId: 'subject-gua1', requestId: 'guardian-period', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified }))
  return { ...f, guardian }
}

describe('guardian period results', () => {
  test('calculates submitted marks without generating or publishing a report', async () => {
    const f = await fixture()
    const response = await f.guardian.getGuardianPeriodResults({ studentId: 'stu1', periodId: 'per1' })
    expect(response.state).toBe('provisional')
    expect(response.average).toBe(16)
    expect(response.marks.map(row => row.id)).toEqual(['ar1'])
    expect(response.marks[0]).toMatchObject({ rank: 1, participantCount: 1 })
    const { mark } = await f.guardian.getGuardianAssessmentResult({ studentId: 'stu1', assessmentId: 'ass1' })
    expect(mark).not.toBeNull()
    expect(response.marks[0]).toMatchObject(mark!)
    expect((await f.guardian.getGuardianAssessmentResult({ studentId: 'other', assessmentId: 'ass1' })).mark).toBeNull()
    expect(response.sections[0]).toMatchObject({ sectionKind: 'module', subResults: [expect.objectContaining({ subjectId: 'subject-math', average: 16, rank: 1, participantCount: 1 })] })
    expect(await f.repositories.results.list({ studentId: 'stu1' })).toHaveLength(0)
  }, 60000)

  test('never includes private draft marks and retains the subject structure', async () => {
    const f = await fixture({ marksApproved: false })
    const response = await f.guardian.getGuardianPeriodResults({ studentId: 'stu1', periodId: 'per1' })
    expect(response.marks).toEqual([])
    expect(response.average).toBeNull()
    expect(response.sections).toHaveLength(1)
  }, 60000)

  test('keeps published results frozen when visible marks change', async () => {
    const f = await fixture()
    const draft = await f.service.assessmentsWorkflow.generateReportCardResult({ id: 'report', studentId: 'stu1', periodId: 'per1' })
    await f.service.assessmentsWorkflow.publishReportCardResult({ id: draft.id, studentId: 'stu1', periodId: 'per1', reviewedDraftVersion: draft.version, reviewedGradingRevision: draft.gradingPolicyRevision, reviewedReportConfigurationRevision: draft.reportConfigurationRevision })
    const before = await f.guardian.getGuardianPeriodResults({ studentId: 'stu1', periodId: 'per1' })
    await f.repositories.assessmentResults.save(new AssessmentResult({ id: 'ar1', assessmentId: 'ass1', studentId: 'stu1', score: 50 }))
    const after = await f.guardian.getGuardianPeriodResults({ studentId: 'stu1', periodId: 'per1' })
    expect(after.state).toBe('published')
    expect(after.average).toBe(before.average)
    expect(after.sections).toEqual(before.sections)
    expect(after.marks[0]?.score).toBe(50)
  }, 60000)

  test('retains readable marks and module structure without a completed grading policy', async () => {
    const f = await fixture()
    const level = (await f.repositories.gradeLevels.findById('grade1'))!
    await f.repositories.gradeLevels.save(new GradeLevel(withShortName({ ...level.data, gradingPolicies: [] })))
    const response = await f.guardian.getGuardianPeriodResults({ studentId: 'stu1', periodId: 'per1' })
    expect(response.calculationReady).toBe(false)
    expect(response.average).toBeNull()
    expect(response.sections).toHaveLength(1)
    expect(response.marks).toHaveLength(1)
  }, 60000)

  test('does not disclose draft report comments and rejects revoked family links', async () => {
    const f = await fixture({ existingReportCard: { id: 'private-report', status: ReportCardResultStatus.Draft, teacherComment: 'Private moderation' } })
    const before = await f.repositories.results.findById('private-report')
    const response = await f.guardian.getGuardianPeriodResults({ studentId: 'stu1', periodId: 'per1' })
    expect(response.teacherComment).toBeNull()
    expect(response.reportId).toBeNull()
    expect((await f.repositories.results.findById('private-report'))?.data).toEqual(before?.data)
    await f.repositories.guardianLinks.delete('link')
    await expect(f.guardian.getGuardianPeriodResults({ studentId: 'stu1', periodId: 'per1' })).rejects.toThrow()
    await expect(f.service.getGuardianPeriodResults({ studentId: 'stu1', periodId: 'per1' })).rejects.toThrow()
  }, 60000)
  test('annual provisional results preserve configured period weights and do not publish drafts', async () => {
    const f = await fixture()
    await f.repositories.academicPeriods.save(new AcademicPeriod(withShortName({ id: 'per2', schoolId: 'sch1', academicYearId: 'ay1', name: 'Second term', type: AcademicPeriodType.Trimester, isPublished: true, startDate: new Date('2026-04-01'), endDate: new Date('2026-06-30') })))
    await f.repositories.academicPeriods.save(new AcademicPeriod(withShortName({ id: 'annual', schoolId: 'sch1', academicYearId: 'ay1', name: 'Annual', type: AcademicPeriodType.Other, isPublished: true, startDate: new Date('2025-09-01'), endDate: new Date('2026-06-30') })))
    const first = (await f.repositories.assessments.findById('ass1'))!
    await f.repositories.assessments.save(new Assessment({ ...first.data, id: 'ass2', periodId: 'per2', startsAt: new Date('2026-05-01'), endsAt: new Date('2026-05-02') }))
    await f.repositories.assessmentResults.save(new AssessmentResult({ id: 'ar2', assessmentId: 'ass2', studentId: 'stu1', score: 60 }))
    for (const periodId of ['per1', 'per2']) {
      const draft = await f.service.assessmentsWorkflow.generateReportCardResult({ id: `report-${periodId}`, studentId: 'stu1', periodId })
      await f.service.assessmentsWorkflow.publishReportCardResult({ id: draft.id, studentId: 'stu1', periodId, reviewedDraftVersion: draft.version, reviewedGradingRevision: draft.gradingPolicyRevision, reviewedReportConfigurationRevision: draft.reportConfigurationRevision })
    }
    await f.service.assessmentsWorkflow.generateReportCardResult({ id: 'annual-report', studentId: 'stu1', periodId: 'annual', aggregation: { source: ReportCardAggregationSource.ReportCards, sourcePeriodIds: ['per1', 'per2'], periodWeightsByPeriodId: { per1: 1, per2: 3 } } })
    const response = await f.guardian.getGuardianPeriodResults({ studentId: 'stu1', periodId: 'annual' })
    expect(response.state).toBe('provisional')
    expect(response.average).toBe(13)
    expect(response.marks).toHaveLength(2)
    expect((await f.repositories.results.findById('annual-report'))?.status).toBe(ReportCardResultStatus.Draft)
  }, 60000)

  test('rejects a different selected year before reading academic values', async () => {
    const f = await fixture()
    const wrongYear = f.forActor(createGuardianActorMetadata({ schoolId: 'sch1', academicYearId: 'ay2', guardianId: 'gua1', subjectId: 'subject-gua1', requestId: 'wrong-year', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified }))
    await expect(wrongYear.getGuardianPeriodResults({ studentId: 'stu1', periodId: 'per1' })).rejects.toThrow()
  }, 60000)
})
