import { AuthorizationError } from '@edaya/authorization'
import { Assessment, AssessmentKind, BusinessRuleViolationError, DeadlineComplianceStatus, RecordingNotificationGateway, ReportCardAggregationSource, ReportCardDefinition, ReportCardResultStatus, School } from '@edaya/core'
import {
  describe,
  expect,
  test,
} from 'bun:test'
import { ASSESSMENT_RESULT_RECORDED_EVENT_KEY, REPORT_CARD_PUBLISHED_EVENT_KEY } from '../../../src/capabilities/notifications'
import {
  createReportCardContext,
} from './report-card-workflow-context'

describe('SchoolService assessment workflows', () => {
  test('generateReportCardResult creates a draft report card through managed service', async () => {
    const { repositories, service } = await createReportCardContext()
    const generatedAt = new Date('2026-04-01T00:00:00Z')

    const result = await service.assessmentsWorkflow.generateReportCardResult({
      id: 'rc1',
      studentId: 'stu1',
      periodId: 'per1',
      reportCardDefinitionId: 'def1',
      generatedAt,
    })

    expect(result.id).toBe('rc1')
    expect(result.status).toBe(ReportCardResultStatus.Draft)
    expect(result.generatedAt).toBe(generatedAt)
    expect(result.overallAverage).toBe(16)
    expect(result.assessmentResultCount).toBe(1)
    expect(result.attendanceSummary.presentCount).toBe(1)
    expect(result.attendanceSummary.absenceCount).toBe(1)
    expect(result.attendanceSummary.excusedAbsenceCount).toBe(1)
    expect(result.attendanceSummary.lateCount).toBe(1)
    expect((await repositories.results.findById(result.id))?.data).toEqual(result.data)
  })

  test('generateReportCardResult reuses existing draft id and generatedAt', async () => {
    const existingGeneratedAt = new Date('2026-03-25T00:00:00Z')
    const { repositories, service } = await createReportCardContext({
      existingReportCard: {
        id: 'rc-existing',
        reportCardDefinitionId: 'def1',
        studentId: 'stu1',
        classGroupId: 'cg1',
        periodId: 'per1',
        status: ReportCardResultStatus.Draft,
        generatedAt: existingGeneratedAt,
      },
    })

    const result = await service.assessmentsWorkflow.generateReportCardResult({
      id: 'rc-new',
      studentId: 'stu1',
      periodId: 'per1',
      reportCardDefinitionId: 'def1',
      generatedAt: new Date('2026-04-01T00:00:00Z'),
    })

    expect(result.id).toBe('rc-existing')
    expect(result.status).toBe(ReportCardResultStatus.Draft)
    expect(result.generatedAt).toEqual(existingGeneratedAt)
    expect((await repositories.results.findById(result.id))?.data).toEqual(result.data)
  })

  test('generateReportCardResult rejects already published report cards', async () => {
    const { service } = await createReportCardContext({
      existingReportCard: {
        id: 'rc-existing',
        studentId: 'stu1',
        periodId: 'per1',
        status: ReportCardResultStatus.Published,
      },
    })

    await expect(service.assessmentsWorkflow.generateReportCardResult({
      id: 'rc1',
      studentId: 'stu1',
      periodId: 'per1',
      reportCardDefinitionId: 'def1',
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('writeHomeroomReportComment updates only the teacher comment on draft cards', async () => {
    const { results, service } = await createReportCardContext()

    await service.assessmentsWorkflow.generateReportCardResult({
      id: 'rc1',
      studentId: 'stu1',
      periodId: 'per1',
      reportCardDefinitionId: 'def1',
    })

    const result = await service.assessmentsWorkflow.writeHomeroomReportComment({
      requestId: 'homeroom-comment',
      expectedVersion: 1,
      id: 'rc1',
      teacherComment: 'Bon début d\'année.',
    })

    expect(result.teacherComment).toBe('Bon début d\'année.')
    expect((await results.findById('rc1'))?.teacherComment).toBe('Bon début d\'année.')
  })

  test('writeReportCardSectionComments updates only the named section comment', async () => {
    const { results, service } = await createReportCardContext()
    const generated = await service.assessmentsWorkflow.generateReportCardResult({
      id: 'rc1',
      studentId: 'stu1',
      periodId: 'per1',
      reportCardDefinitionId: 'def1',
    })
    const math = generated.sectionResults.flatMap(section => section.subResults).find(section => section.classSubjectId === 'cs1')
    expect(math?.sectionId).toBeTruthy()

    const updated = await service.assessmentsWorkflow.writeReportCardSectionComments({
      requestId: 'section-comment',
      expectedVersion: 1,
      id: generated.id,
      sections: [{ sectionId: math!.sectionId, comment: 'Solide en calcul.' }],
    })

    const updatedMath = updated.sectionResults.flatMap(section => section.subResults).find(section => section.sectionId === math!.sectionId)
    expect(updatedMath?.comment).toBe('Solide en calcul.')
    expect(updated.overallAverage).toBe(generated.overallAverage)
    expect(updated.teacherComment).toBe(generated.teacherComment)
    expect((await results.findById(generated.id))?.sectionResults.flatMap(section => section.subResults).find(section => section.sectionId === math!.sectionId)?.comment).toBe('Solide en calcul.')
  })

  test('publishReportCardResult publishes generated report cards through managed service', async () => {
    const { repositories, service } = await createReportCardContext()

    const result = await service.assessmentsWorkflow.publishReportCardResult({
      id: 'rc1',
      studentId: 'stu1',
      periodId: 'per1',
      reportCardDefinitionId: 'def1',
      publishedAt: new Date('2026-04-01T00:00:00Z'),
    })

    expect(result.id).toBe('rc1')
    expect(result.status).toBe(ReportCardResultStatus.Published)
    expect(result.overallAverage).toBe(16)
    expect(result.assessmentResultCount).toBe(1)
    expect(result.attendanceSummary.presentCount).toBe(1)
    expect(result.attendanceSummary.excusedAbsenceCount).toBe(1)
    expect((await repositories.results.findById(result.id))?.data).toEqual(result.data)
  })

  test('publishReportCardResult enqueues guardian and student notifications', async () => {
    const gateway = new RecordingNotificationGateway()
    const { repositories, service } = await createReportCardContext({ notificationGateway: gateway })

    await service.assessmentsWorkflow.publishReportCardResult({
      id: 'rc1',
      studentId: 'stu1',
      periodId: 'per1',
      reportCardDefinitionId: 'def1',
      publishedAt: new Date('2026-04-01T00:00:00Z'),
    })

    expect(gateway.enqueued).toHaveLength(2)
    expect(gateway.enqueued.map(entry => entry.idempotencyKey).sort()).toEqual((await repositories.messageDeliveries.list()).map(entry => entry.id).sort())
    expect(gateway.enqueued.every(entry => entry.schoolId === 'sch1' && entry.kind === 'event' && entry.eventKey === REPORT_CARD_PUBLISHED_EVENT_KEY)).toBe(true)
  })

  test('draft recordAssessmentResult does not disclose marks to families', async () => {
    const gateway = new RecordingNotificationGateway()
    const { repositories, service } = await createReportCardContext({ notificationGateway: gateway, marksApproved: false })

    await repositories.assessmentResults.delete('ar1')
    await service.assessmentsWorkflow.recordAssessmentResult({
      requestId: 'new-mark',
      expectedRevision: 0,
      id: 'ar-new',
      studentId: 'stu1',
      assessmentId: 'ass1',
      score: 92,
    })

    expect(gateway.enqueued).toHaveLength(0)
    expect(gateway.enqueued.map(entry => entry.idempotencyKey).sort()).toEqual((await repositories.messageDeliveries.list()).map(entry => entry.id).sort())
    expect(gateway.enqueued.every(entry => entry.schoolId === 'sch1' && entry.kind === 'event' && entry.eventKey === ASSESSMENT_RESULT_RECORDED_EVENT_KEY)).toBe(true)
  })

  test('publishReportCardResult rejects unpublished academic periods', async () => {
    const { service } = await createReportCardContext({
      academicPeriodPublished: false,
    })

    await expect(service.assessmentsWorkflow.publishReportCardResult({
      id: 'rc1',
      studentId: 'stu1',
      periodId: 'per1',
      reportCardDefinitionId: 'def1',
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('publishReportCardResult returns the existing logical publication without creating another', async () => {
    const { service } = await createReportCardContext({
      existingReportCard: {
        id: 'rc-existing',
        studentId: 'stu1',
        periodId: 'per1',
        status: ReportCardResultStatus.Published,
      },
    })

    await expect(service.assessmentsWorkflow.publishReportCardResult({
      id: 'rc1',
      studentId: 'stu1',
      periodId: 'per1',
      reportCardDefinitionId: 'def1',
    })).resolves.toMatchObject({ id: 'rc-existing', status: ReportCardResultStatus.Published })
  })

  test('createGradeScale and completeAssessment persist assessment catalog entities', async () => {
    const { repositories, service } = await createReportCardContext()
    await repositories.assessments.save(new Assessment({
      id: 'ass1',
      classGroupId: 'cg1',
      classSubjectId: 'cs1',
      periodId: 'per1',
      title: 'Math test',
      kind: AssessmentKind.Quiz,
      maxScore: 100,
      coefficient: 1,
      description: 'Math test',
      startsAt: new Date('2026-02-01T09:00:00Z'),
      endsAt: new Date('2026-02-01T10:00:00Z'),
    }))

    const gradeScale = await service.assessmentsWorkflow.createGradeScale({
      id: 'gs1',
      schoolId: 'sch1',
      name: '20-point',
      minScore: 0,
      maxScore: 20,
      ranges: [{ letter: 'A', minScore: 16, maxScore: 20 }],
    })
    expect(gradeScale.name).toBe('20-point')
    expect(await repositories.gradeScales.findById('gs1')).toBeDefined()

    await repositories.assessmentResults.delete('ar1')

    const completed = await service.assessmentsWorkflow.completeAssessment({
      assessmentId: 'ass1',
      completedAt: new Date('2026-02-01T10:30:00Z'),
    })
    expect(completed.completedAt?.toISOString()).toBe('2026-02-01T10:30:00.000Z')
    expect((await repositories.assessments.findById('ass1'))?.completedAt).toEqual(completed.completedAt)
  })

  test('listClassSubjectAssessmentResultsForPeriod returns assessment results for a class subject', async () => {
    const { service } = await createReportCardContext()

    const results = await service.assessmentsWorkflow.listClassSubjectAssessmentResultsForPeriod({
      classSubjectId: 'cs1',
      periodId: 'per1',
    })

    expect(results).toHaveLength(1)
    expect(results[0]?.studentId).toBe('stu1')
  })

  test('recordAssessmentResultCompliance records compliance without inventing a numeric mark', async () => {
    const { repositories, service } = await createReportCardContext({ marksApproved: false })

    await repositories.assessmentResults.delete('ar1')
    const result = await service.assessmentsWorkflow.recordAssessmentResultCompliance({
      requestId: 'compliance',
      expectedRevision: 0,
      id: 'ar-compliance',
      studentId: 'stu1',
      assessmentId: 'ass1',
      status: DeadlineComplianceStatus.Late,
    })

    expect(result.score).toBeUndefined()
    expect(result.status).toBe(DeadlineComplianceStatus.Late)
  })

  test('generateReportCardResult uses the default definition when none is provided', async () => {
    const { repositories, service } = await createReportCardContext()
    const definition = (await repositories.definitions.findById('def1'))!
    await repositories.definitions.save(new ReportCardDefinition({ ...definition.data, id: 'def-default', isDefault: true }))

    const result = await service.assessmentsWorkflow.generateReportCardResult({
      id: 'rc-default',
      studentId: 'stu1',
      periodId: 'per1',
    })

    expect(result.reportCardDefinitionId).toBe('def-default')
  })

  test('publishReportCardResult rejects aggregated sources that are not ready', async () => {
    const { service } = await createReportCardContext()

    await expect(service.assessmentsWorkflow.publishReportCardResult({
      id: 'rc-agg',
      studentId: 'stu1',
      periodId: 'per1',
      reportCardDefinitionId: 'def1',
      aggregation: {
        source: ReportCardAggregationSource.ReportCards,
        sourcePeriodIds: ['per-t1', 'per-unpublished'],
      },
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('writeHomeroomReportComment rejects actors without report card access', async () => {
    const { repositories, service } = await createReportCardContext()

    await service.assessmentsWorkflow.generateReportCardResult({
      id: 'rc1',
      studentId: 'stu1',
      periodId: 'per1',
      reportCardDefinitionId: 'def1',
    })

    const school = (await repositories.schools.findById('sch1'))!
    await repositories.schools.save(new School({ ...school.data, ownerSubjectId: undefined }))
    await expect(service.assessmentsWorkflow.writeHomeroomReportComment({
      requestId: 'homeroom-comment',
      expectedVersion: 1,
      id: 'rc1',
      teacherComment: 'Needs improvement',
    })).rejects.toBeInstanceOf(AuthorizationError)
  })
})
