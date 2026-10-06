import type { AcademicPeriod, DocumentIssuanceSnapshot, DocumentRendererPort, ReportCardResult } from '@edaya/core'
import type { SchoolService } from '../../services/school-service'
import { Attachment, AttachmentOwnerKind, AttachmentStatus, BusinessRuleViolationError, ReportCardResultStatus } from '@edaya/core'
import { validateAttachmentSave } from '../../services/entities/config/school/attachment'
import { buildStorageKey } from '../files/build-storage-key'
import { buildReportCardV1Payload } from './build-report-card-v1-payload'
import { catalogLangFromLocale, catalogSubjectName } from './catalog-label'
import { captureTeacherSignatures, freezeDocumentTeachers, freezeTeachersBySubject, hydrateTeacherSignatures } from './document-teachers'

export interface RenderReportCardDocumentInput {
  resultId: string
  renderer: DocumentRendererPort
  locale?: string
}

type DocumentContext = Awaited<ReturnType<SchoolService['baseService']['access']['reportCards']['documentContext']>>

function assertPublished(result: ReportCardResult, period: AcademicPeriod): void {
  if (result.status !== ReportCardResultStatus.Published || !period.isPublished)
    throw new BusinessRuleViolationError('REPORT_DOCUMENT_UNPUBLISHED', 'Report documents require a published result and academic period')
}

function readyDocument(context: DocumentContext) {
  const attachment = context.attachments.find(entry => entry.status === AttachmentStatus.Ready
    && entry.mimeType === 'application/pdf' && entry.storageKey
    && (entry.sizeBytes === undefined || entry.sizeBytes >= 2_048))
  return attachment?.storageKey ? { attachmentId: attachment.id, storageKey: attachment.storageKey } : undefined
}

function documentSource(context: DocumentContext, locale: string, captured?: DocumentIssuanceSnapshot['teacherSignatures']) {
  const { result, student, school, period, classGroup, academicYear, subjects, teacherNameByClassSubjectId, homeroomTeacherName, peerResults } = context
  const catalogLang = catalogLangFromLocale(locale)
  const subjectNameByClassSubjectId = new Map(subjects.map(({ classSubjectId, subject }) => [classSubjectId, catalogSubjectName(subject.name, catalogLang, subject.code)]))
  // Repository order must not affect floating-point accumulation or source comparisons.
  const peerAverages = [...peerResults].sort((a, b) => a.id.localeCompare(b.id)).map(entry => entry.overallAverage).filter((value): value is number => value !== undefined)
  const formatAverage = (value: number) => `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} / 20`
  const payload = buildReportCardV1Payload({
    result,
    student,
    school,
    periodLabel: period.name,
    classLabel: classGroup.name,
    schoolYear: academicYear.name,
    locale,
    subjectNameByClassSubjectId,
    teacherNameByClassSubjectId,
    teachersByClassSubjectId: freezeTeachersBySubject(context.teachersByClassSubjectId, captured),
    homeroomTeachers: freezeDocumentTeachers(context.homeroomTeachers, captured),
    homeroomTeacherName,
    classResults: peerAverages.length
      ? {
          classAverage: formatAverage(peerAverages.reduce((sum, value) => sum + value, 0) / peerAverages.length),
          lowestAverage: formatAverage(Math.min(...peerAverages)),
          highestAverage: formatAverage(Math.max(...peerAverages)),
        }
      : undefined,
  })
  return {
    payload,
    // This guards the in-flight rendering window, not long-term document versioning.
    signature: JSON.stringify({ resultId: result.id, studentId: student.id, schoolId: school.id, periodId: period.id, classGroupId: classGroup.id, academicYearId: academicYear.id, definitionId: result.reportCardDefinitionId, publishedAt: result.publishedAt, payload }),
  }
}

async function documentEffect<T>(failure: 'REPORT_DOCUMENT_RENDER_UNAVAILABLE' | 'REPORT_DOCUMENT_STORAGE_UNAVAILABLE', effect: () => Promise<T>): Promise<T> {
  try {
    return await effect()
  }
  catch {
    // Provider diagnostics can contain private URLs or rendered pupil data.
    throw new Error(failure)
  }
}

/** Render and store outside SQL; reauthorize and compare the source before publishing. Call outside a business transaction. */
export async function renderReportCardDocument(
  service: SchoolService,
  input: RenderReportCardDocumentInput,
): Promise<{ attachmentId: string, storageKey: string } | null> {
  const base = service.baseService
  const { access, repositories } = base
  const locale = input.locale ?? 'fr-FR'
  const lock = { lockKeys: [`report-card-document:${JSON.stringify([base.actor.schoolId, input.resultId])}`] }
  const load = async () => {
    const context = await access.reportCards.documentContext(input.resultId)
    assertPublished(context.result, context.period)
    return context
  }
  const initial = await base.atomicExecution.execute(async () => {
    const context = await load()
    const cached = readyDocument(context)
    if (cached)
      return { cached }
    if (context.result.sectionResults.length === 0)
      return { empty: true as const }
    return { source: documentSource(context, locale), schoolId: context.school.id }
  }, lock)
  if (initial.cached)
    return initial.cached
  if (!initial.source)
    return null
  const source = initial.source
  const currentContext = async () => {
    const current = await load()
    if (current.result.sectionResults.length === 0 || documentSource(current, locale, captureTeacherSignatures(source.payload as unknown as Record<string, unknown>)).signature !== source.signature)
      throw new BusinessRuleViolationError('REPORT_DOCUMENT_SOURCE_CHANGED', 'Report document source changed; request a new rendering')
    return current
  }
  const authorizeAttachment = async (attachment: Attachment) => {
    const { scope, result, period } = await access.reportCards.assertDocumentAttachment(input.resultId, attachment)
    assertPublished(result, period)
    const previous = await repositories.attachments.forAccess(scope).findById(attachment.id)
    await validateAttachmentSave(attachment, previous, repositories)
    return repositories.attachments.forAccess(scope)
  }

  const payload = await hydrateTeacherSignatures(base, source.payload as unknown as Record<string, unknown>, () => access.reportCards.documentContext(input.resultId), captureTeacherSignatures(source.payload as unknown as Record<string, unknown>))
  const rendered = await documentEffect('REPORT_DOCUMENT_RENDER_UNAVAILABLE', () => input.renderer.render({ templateKey: 'report-card.v1', locale: locale.toLowerCase().startsWith('en') ? 'en' : 'fr', payload }))
  const attachmentId = crypto.randomUUID()
  const fileName = locale.toLowerCase().startsWith('en') ? `report-card-${input.resultId}.pdf` : `bulletin-${input.resultId}.pdf`
  const storageKey = buildStorageKey({ schoolId: initial.schoolId, purpose: 'generated/report-card', ownerKind: AttachmentOwnerKind.ReportCard, ownerId: input.resultId, attachmentId, fileName })
  const attachment = new Attachment({
    id: attachmentId,
    schoolId: initial.schoolId,
    ownerKind: AttachmentOwnerKind.ReportCard,
    ownerId: input.resultId,
    fileName,
    storageKey,
    status: AttachmentStatus.Ready,
    checksum: rendered.sha256,
    mimeType: 'application/pdf',
    sizeBytes: rendered.bytes.byteLength,
    uploadedById: base.actor.kind === 'staff' ? base.actor.staffMemberId : undefined,
  })
  const winner = await base.atomicExecution.execute(async () => {
    const current = await currentContext()
    await authorizeAttachment(attachment)
    const cached = readyDocument(current)
    if (!cached)
      await repositories.privateFiles.reserve({ schoolId: attachment.schoolId, storageKey, protectedUntil: new Date(Date.now() + 60 * 60 * 1000) })
    return cached
  }, lock)
  if (winner)
    return winner
  const put = await documentEffect('REPORT_DOCUMENT_STORAGE_UNAVAILABLE', () => base.fileStorage.putObject({
    key: storageKey,
    body: rendered.bytes,
    contentType: 'application/pdf',
    metadata: { reportCardResultId: input.resultId, sha256: rendered.sha256, renderId: rendered.renderId },
  }))
  return base.atomicExecution.execute(async () => {
    const current = await currentContext()
    const cached = readyDocument(current)
    if (cached)
      return cached
    // Replace legacy tiny PDFs only in the same commit as a successful attachment.
    for (const stub of current.attachments.filter(entry => entry.status === AttachmentStatus.Ready && entry.mimeType === 'application/pdf' && entry.sizeBytes !== undefined && entry.sizeBytes < 2_048)) {
      const failed = new Attachment({ ...stub.data, status: AttachmentStatus.Failed })
      await (await authorizeAttachment(failed)).save(failed)
    }
    const completed = new Attachment({ ...attachment.data, sizeBytes: put.sizeBytes })
    await (await authorizeAttachment(completed)).save(completed)
    return { attachmentId, storageKey }
  }, lock)
}
