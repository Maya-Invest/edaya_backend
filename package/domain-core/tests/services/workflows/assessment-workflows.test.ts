import {
  describe,
  expect,
  test,
} from 'bun:test'
import { MessageDeliveryRecipientKind, ReportCardResultStatus } from '../../../src/domains'
import {
  ASSESSMENT_RESULT_RECORDED_EVENT_KEY,
  RecordingNotificationGateway,
  REPORT_CARD_PUBLISHED_EVENT_KEY,
} from '../../../src/notifications'
import { BusinessRuleViolationError } from '../../../src/shared/business-rule-error'
import {
  actor,
  createReportCardContext,
} from './workflow-test-context'

describe('SchoolService assessment workflows', () => {
  test('generateReportCardResult creates a draft report card through managed service', async () => {
    const { mockPolicy, mockRepos, savedReportCards, service } = createReportCardContext()
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
    expect(savedReportCards.get('rc1')).toBe(result)
    expect(mockPolicy.checkStudentAccess).toHaveBeenCalledWith(actor, ['stu1'])
    expect(mockRepos.results.save).toHaveBeenCalledWith(result)
  })

  test('generateReportCardResult reuses existing draft id and generatedAt', async () => {
    const existingGeneratedAt = new Date('2026-03-25T00:00:00Z')
    const { mockPolicy, mockRepos, service } = createReportCardContext({
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
    expect(result.generatedAt).toBe(existingGeneratedAt)
    expect(mockPolicy.checkReportCardResultAccess).toHaveBeenCalledWith(actor, ['rc-existing'])
    expect(mockRepos.results.save).toHaveBeenCalledWith(result)
  })

  test('generateReportCardResult rejects already published report cards', async () => {
    const { service } = createReportCardContext({
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

  test('publishReportCardResult publishes generated report cards through managed service', async () => {
    const { mockAtomic, mockPolicy, mockRepos, service } = createReportCardContext()

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
    expect(mockAtomic.execute).toHaveBeenCalled()
    expect(mockPolicy.checkStudentAccess).toHaveBeenCalledWith(actor, ['stu1'])
    expect(mockPolicy.checkReportCardResultAccess).toHaveBeenCalledWith(actor, ['rc1'])
    expect(mockRepos.results.save).toHaveBeenCalledWith(result)
  })

  test('publishReportCardResult enqueues guardian and student notifications', async () => {
    const gateway = new RecordingNotificationGateway()
    const { service } = createReportCardContext({ notificationGateway: gateway })

    await service.assessmentsWorkflow.publishReportCardResult({
      id: 'rc1',
      studentId: 'stu1',
      periodId: 'per1',
      reportCardDefinitionId: 'def1',
      publishedAt: new Date('2026-04-01T00:00:00Z'),
    })

    expect(gateway.enqueued).toHaveLength(1)
    expect(gateway.enqueued[0]).toMatchObject({
      idempotencyKey: `${REPORT_CARD_PUBLISHED_EVENT_KEY}:rc1`,
      schoolId: 'sch1',
      kind: 'event',
      eventKey: REPORT_CARD_PUBLISHED_EVENT_KEY,
    })
    expect(gateway.enqueued[0]?.recipients).toEqual(expect.arrayContaining([
      { kind: MessageDeliveryRecipientKind.Student, id: 'stu1' },
      { kind: MessageDeliveryRecipientKind.Guardian, id: 'gua1' },
    ]))
  })

  test('recordAssessmentResult enqueues guardian and student notifications', async () => {
    const gateway = new RecordingNotificationGateway()
    const { service } = createReportCardContext({ notificationGateway: gateway })

    await service.assessmentsWorkflow.recordAssessmentResult({
      id: 'ar-new',
      studentId: 'stu1',
      assessmentId: 'ass1',
      score: 92,
    })

    expect(gateway.enqueued).toHaveLength(1)
    expect(gateway.enqueued[0]).toMatchObject({
      idempotencyKey: `${ASSESSMENT_RESULT_RECORDED_EVENT_KEY}:ar-new`,
      schoolId: 'sch1',
      kind: 'event',
      eventKey: ASSESSMENT_RESULT_RECORDED_EVENT_KEY,
    })
    expect(gateway.enqueued[0]?.recipients).toEqual(expect.arrayContaining([
      { kind: MessageDeliveryRecipientKind.Student, id: 'stu1' },
      { kind: MessageDeliveryRecipientKind.Guardian, id: 'gua1' },
    ]))
  })

  test('publishReportCardResult rejects already published report cards', async () => {
    const { service } = createReportCardContext({
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
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })
})
