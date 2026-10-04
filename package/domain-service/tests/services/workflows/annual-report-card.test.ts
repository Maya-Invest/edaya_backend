/* eslint-disable dot-notation -- TypeScript requires bracket access for environment variable index signatures. */
import type { DocumentRenderInput } from '@edaya/core'
import { writeFileSync } from 'node:fs'
import { ActorAssuranceLevel, createGuardianActorMetadata, createTeacherActorMetadata } from '@edaya/authorization'
import { AcademicPeriod, AcademicPeriodType, Assessment, AssessmentResult, DocumentIssuanceStatus, reportCardAcademicVersion, ReportCardAggregationSource, ReportCardResult, ReportCardResultStatus, Teacher, TeacherAssignment, TeacherAssignmentKind } from '@edaya/core'
import { dispatchDocumentRender } from '@edaya/service'
import { describe, expect, test } from 'bun:test'
import { createChromePdfRenderer, createDocumentRenderer, detectChromeExecutable } from '../../../../adaptor-docs/src/index'
import { createReportCardContext } from './report-card-workflow-context'

async function annualFixture(hook?: (input: DocumentRenderInput) => Promise<void>) {
  const rendered: DocumentRenderInput[] = []
  const realPdf = process.env['ANNUAL_REPORT_CARD_REAL_PDF'] === '1'
  const renderer = createDocumentRenderer({ pdfRenderer: realPdf
    ? createChromePdfRenderer(detectChromeExecutable()!)
    : { async render() { return new TextEncoder().encode('%PDF-annual-workflow') } } })
  const f = await createReportCardContext({ documentRenderer: { async render(input) {
    rendered.push(input)
    const result = await renderer.render(input)
    if (realPdf && input.templateKey === 'annual-report-card.v1')
      writeFileSync('/tmp/annual-report-card-workflow.pdf', result.bytes)
    await hook?.(input)
    return result
  } } })
  await f.repositories.academicPeriods.save(new AcademicPeriod({ id: 'sem2', schoolId: 'sch1', academicYearId: 'ay1', name: 'Second semester', type: AcademicPeriodType.Semester, startDate: new Date('2026-04-01'), endDate: new Date('2026-06-30'), isPublished: true }))
  await f.repositories.academicPeriods.save(new AcademicPeriod({ id: 'annual', schoolId: 'sch1', academicYearId: 'ay1', name: 'Annual', type: AcademicPeriodType.Other, startDate: new Date('2025-09-01'), endDate: new Date('2026-06-30'), isPublished: true }))
  const assessment = (await f.repositories.assessments.findById('ass1'))!
  await f.repositories.assessments.save(new Assessment({ ...assessment.data, id: 'ass2', periodId: 'sem2', startsAt: new Date('2026-05-01'), endsAt: new Date('2026-05-02') }))
  await f.repositories.assessmentResults.save(new AssessmentResult({ id: 'ar2', studentId: 'stu1', assessmentId: 'ass2', score: 60 }))
  for (const periodId of ['per1', 'sem2']) {
    await f.service.assessmentsWorkflow.generateReportCardResult({ id: `report-${periodId}`, studentId: 'stu1', periodId, reportCardDefinitionId: 'def1' })
    await f.service.assessmentsWorkflow.publishReportCardResult({ id: `report-${periodId}`, studentId: 'stu1', periodId, reportCardDefinitionId: 'def1' })
  }
  const draft = await f.service.assessmentsWorkflow.generateReportCardResult({
    id: 'annual-result',
    studentId: 'stu1',
    periodId: 'annual',
    reportCardDefinitionId: 'def1',
    aggregation: { source: ReportCardAggregationSource.ReportCards, sourcePeriodIds: ['sem2', 'per1'], periodWeightsByPeriodId: { per1: 1, sem2: 3 }, sourceReportVersions: [{ periodId: 'per1', resultId: 'untrusted', version: 0, sourceVersion: 'untrusted' }] },
  })
  const annual = await f.service.assessmentsWorkflow.publishReportCardResult({ id: draft.id, studentId: 'stu1', periodId: 'annual', reportCardDefinitionId: 'def1' })
  const family = f.forActor(createGuardianActorMetadata({ schoolId: 'sch1', guardianId: 'gua1', subjectId: 'subject-gua1', requestId: 'annual-family', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified }))
  const request = (requestId = 'issue-annual') => f.service.documentsWorkflow.requestDocumentIssuance({ requestId, templateKey: 'annual-report-card.v1', sourceId: annual.id, locale: 'en' })
  return { ...f, annual, draft, rendered, family, request }
}

describe('official annual report card workflow', () => {
  test('published weighted annual grades issue a landscape PDF available to the guardian', async () => {
    const f = await annualFixture()
    expect(f.draft.overallAverage).toBe(13)
    await expect(f.service.assessmentsWorkflow.generateReportCardResult({ id: f.annual.id, studentId: 'stu1', periodId: 'annual', reportCardDefinitionId: 'def1' })).rejects.toMatchObject({ code: 'PUBLISHED_REPORT_CARD_IMMUTABLE' })
    expect(f.annual.aggregation?.sourceReportVersions).toHaveLength(2)
    const source = (await f.repositories.results.findById('report-per1'))!
    expect(f.annual.aggregation?.sourceReportVersions?.find(row => row.periodId === 'per1')?.sourceVersion).toBe(await reportCardAcademicVersion(source))
    const issued = await f.request()
    expect((await f.request()).id).toBe(issued.id)
    const stored = (await f.repositories.documentIssuances.findById(issued.id))!
    expect(stored.snapshot.academicSources).toHaveLength(3)
    const facts = stored.snapshot.facts as { subjects: Array<{ average: string, total: string, periodAverages: string[] }>, classResults: { classAverage: string } }
    expect(facts.subjects[0]).toMatchObject({ periodAverages: ['16.00', '12.00'], average: '13.00', total: '13.00' })
    expect(facts.subjects.at(-1)?.total).toBe('13.00')
    expect(facts.classResults.classAverage).toBe('13.00 / 20')
    await dispatchDocumentRender(f.application)
    expect((await f.repositories.documentIssuances.findById(issued.id))?.status).toBe(DocumentIssuanceStatus.Ready)
    expect(f.rendered.find(input => input.templateKey === 'annual-report-card.v1')?.options?.orientation).toBe('landscape')
    const listed = await f.family.documentsWorkflow.listDocumentIssuances({ studentId: 'stu1', academicYearId: 'ay1' })
    expect(listed.some(entry => entry.id === issued.id)).toBe(true)
    expect((await f.family.documentsWorkflow.grantDocumentDownload({ id: issued.id })).downloadUrl).toContain('memory://')
    await f.repositories.guardianLinks.delete('link')
    await expect(f.family.documentsWorkflow.grantDocumentDownload({ id: issued.id })).rejects.toThrow()
  }, 60000)

  test('changed, unpublished and pending contributing grades block issuance and downloads', async () => {
    const f = await annualFixture()
    const issued = await f.request()
    await dispatchDocumentRender(f.application)
    const source = (await f.repositories.results.findById('report-sem2'))!
    for (const change of [
      { calculationStale: true },
      { pendingCorrectionIds: ['correction'] },
      { pendingAssessmentIds: ['ass2'] },
      { status: ReportCardResultStatus.Draft, publishedAt: undefined },
      { overallAverage: 0, version: source.version + 1 },
    ]) {
      await f.repositories.results.save(new ReportCardResult({ ...source.data, sectionResults: [...source.sectionResults], ...change }))
      await expect(f.request(`blocked-${JSON.stringify(change)}`)).rejects.toThrow()
      await expect(f.family.documentsWorkflow.grantDocumentDownload({ id: issued.id })).rejects.toThrow()
    }
    await f.repositories.results.save(source)
    const period = (await f.repositories.academicPeriods.findById('sem2'))!
    await f.repositories.academicPeriods.save(new AcademicPeriod({ ...period.data, isPublished: false }))
    await expect(f.request('period-unpublished')).rejects.toMatchObject({ code: 'DOCUMENT_SOURCE_UNPUBLISHED' })
  }, 60000)

  test('changes during rendering cannot bind an obsolete PDF; regeneration permits a replacement', async () => {
    let changeDuringRender: (() => Promise<void>) | undefined
    const f = await annualFixture(async () => {
      await changeDuringRender?.()
    })
    const issued = await f.request()
    const original = (await f.repositories.results.findById('report-sem2'))!
    changeDuringRender = async () => {
      await f.repositories.results.save(new ReportCardResult({ ...original.data, sectionResults: [...original.sectionResults], overallAverage: 14, version: original.version + 1 }))
      changeDuringRender = undefined
    }
    await dispatchDocumentRender(f.application)
    expect((await f.repositories.documentIssuances.findById(issued.id))?.status).toBe(DocumentIssuanceStatus.Failed)
    expect((await f.repositories.documentIssuances.findById(issued.id))?.failureCode).toBe('DOCUMENT_SOURCE_CHANGED')
    await expect(f.service.documentsWorkflow.retryDocumentIssuance({ requestId: 'stale-retry', issuanceId: issued.id })).rejects.toThrow()
    const regenerated = await f.service.assessmentsWorkflow.generateReportCardResult({ id: f.annual.id, studentId: 'stu1', periodId: 'annual', reportCardDefinitionId: 'def1' })
    expect(regenerated.status).toBe(ReportCardResultStatus.Draft)
    await expect(f.request('not-yet-published')).rejects.toMatchObject({ code: 'DOCUMENT_SOURCE_UNPUBLISHED' })
    await f.service.assessmentsWorkflow.publishReportCardResult({ id: regenerated.id, studentId: 'stu1', periodId: 'annual', reportCardDefinitionId: 'def1' })
    const replacement = await f.service.documentsWorkflow.correctDocumentIssuance({ requestId: 'replacement', issuanceId: issued.id, templateKey: 'annual-report-card.v1', sourceId: f.annual.id })
    await dispatchDocumentRender(f.application)
    expect((await f.repositories.documentIssuances.findById(replacement.id))?.status).toBe(DocumentIssuanceStatus.Ready)
    expect((await f.repositories.documentIssuances.findById(issued.id))?.replacedByIssuanceId).toBe(replacement.id)
  }, 60000)

  test('a temporary renderer failure retries the same immutable annual snapshot', async () => {
    let unavailable = true
    const f = await annualFixture(async (input) => {
      if (input.templateKey === 'annual-report-card.v1' && unavailable)
        throw new Error('Temporary renderer outage')
    })
    const issued = await f.request()
    await dispatchDocumentRender(f.application)
    expect((await f.repositories.documentIssuances.findById(issued.id))?.failureCode).toBe('DOCUMENT_RENDER_UNAVAILABLE')
    unavailable = false
    await f.service.documentsWorkflow.retryDocumentIssuance({ requestId: 'annual-retry', issuanceId: issued.id })
    await dispatchDocumentRender(f.application)
    expect((await f.repositories.documentIssuances.findById(issued.id))?.status).toBe(DocumentIssuanceStatus.Ready)
    expect((await f.repositories.documentIssuances.findById(issued.id))?.number).toBe(issued.number)
  }, 60000)

  test('reviewed annual council feedback replaces the annual PDF after rendering succeeds', async () => {
    const f = await annualFixture()
    await f.repositories.teachers.save(new Teacher({ id: 'annual-teacher', schoolId: 'sch1', firstName: 'Annual', lastName: 'Teacher', subjectId: 'annual-teacher-subject' }))
    await f.repositories.teacherAssignments.save(new TeacherAssignment({ id: 'annual-homeroom', teacherId: 'annual-teacher', academicYearId: 'ay1', classGroupId: 'cg1', kind: TeacherAssignmentKind.Homeroom }))
    const teacher = f.forActor(createTeacherActorMetadata({ schoolId: 'sch1', teacherId: 'annual-teacher', subjectId: 'annual-teacher-subject', academicYearId: 'ay1', requestId: 'annual-comment', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified }))
    const issued = await f.request()
    await dispatchDocumentRender(f.application)
    const correction = await teacher.teacherCorrectionsWorkflow.request({ requestId: 'annual-feedback-request', expectedVersion: f.annual.version, reason: 'Clarify the annual council feedback', proposal: { workflow: 'report_comments', targetId: f.annual.id, teacherComment: 'Steady progress throughout the year.', sections: [] } })
    const decision = await f.service.teacherCorrectionsWorkflow.decide('approve', { requestId: 'annual-feedback-approve', correctionId: correction.id, expectedVersion: 0, confirmConsequences: true })
    const revised = (await f.repositories.documentIssuances.findById(decision.documentIssuanceId!))!
    expect(revised.templateKey).toBe('annual-report-card.v1')
    expect((await f.repositories.documentIssuances.findById(issued.id))?.status).toBe(DocumentIssuanceStatus.Ready)
    const facts = revised.snapshot.facts as { council: { appreciation: string }, subjects: Array<{ average: string }> }
    expect(facts.council.appreciation).toBe('Steady progress throughout the year.')
    expect(facts.subjects[0]?.average).toBe('13.00')
    await dispatchDocumentRender(f.application)
    expect((await f.repositories.documentIssuances.findById(issued.id))?.status).toBe(DocumentIssuanceStatus.Superseded)
    expect((await f.repositories.documentIssuances.findById(revised.id))?.status).toBe(DocumentIssuanceStatus.Ready)
    expect((await f.family.documentsWorkflow.grantDocumentDownload({ id: revised.id })).downloadUrl).toContain('memory://')
  }, 60000)
})
