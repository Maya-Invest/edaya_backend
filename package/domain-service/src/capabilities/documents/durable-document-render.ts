import type { ClaimedDurableWork, DocumentIssuance } from '@edaya/core'
import type { SchoolApplication } from '../../services/school-application'
import { createSystemActorMetadata } from '@edaya/authorization'
import {
  Attachment,
  AttachmentOwnerKind,
  AttachmentStatus,
  BusinessRuleViolationError,
  DOCUMENT_FAILURES,
  DOCUMENT_ISSUANCE_CAPABILITY,
  DOCUMENT_ISSUANCE_PURPOSE,
  DocumentIssuanceStatus,
  resourceAccessScope,
} from '@edaya/core'
import { validateAttachmentSave } from '../../services/entities/config/school/attachment'
import { buildStorageKey } from '../files/build-storage-key'
import { DurableWorkFailure, runDurableWorkBatch } from '../scheduling-jobs/durable-work'
import { assembleDocumentSource, assembleInputFromIssuance } from './assemble-document-source'
import { documentArtifactFileName } from './document-projection'
import { hydrateDocumentPayload } from './hydrate-document-payload'

export const DOCUMENT_RENDER_KIND = 'document.render'
export const DOCUMENT_PREVIEW_KIND = 'document.preview'

const PERMANENT_FAILURES = new Set<string>([
  DOCUMENT_FAILURES.SOURCE_UNPUBLISHED,
  DOCUMENT_FAILURES.SOURCE_MISSING,
  DOCUMENT_FAILURES.SOURCE_INACCESSIBLE,
  DOCUMENT_FAILURES.TEMPLATE_UNSUPPORTED,
  DOCUMENT_FAILURES.LOCALE_UNSUPPORTED,
  DOCUMENT_FAILURES.ASSET_MISSING,
  DOCUMENT_FAILURES.SOURCE_CHANGED,
  DOCUMENT_FAILURES.INPUT_CONFLICT,
  DOCUMENT_FAILURES.PREVIEW_REQUIRED,
  DOCUMENT_FAILURES.NOT_RETRYABLE,
])

function asFailure(error: unknown): DurableWorkFailure {
  if (error instanceof DurableWorkFailure)
    return error
  if (error instanceof BusinessRuleViolationError)
    return new DurableWorkFailure(error.code, PERMANENT_FAILURES.has(error.code))
  return new DurableWorkFailure(DOCUMENT_FAILURES.RENDER_UNAVAILABLE)
}

async function markFailed(application: Pick<SchoolApplication, 'forActor'>, work: ClaimedDurableWork, code: string) {
  const base = application.forActor(createSystemActorMetadata({
    systemId: 'document-render',
    schoolId: work.schoolId,
    requestId: work.id,
    reason: 'durable document render failure',
  })).baseService
  await base.atomicExecution.execute(async () => {
    const issuance = await base.repositories.documentIssuances.findById(work.resourceId)
    if (!issuance || issuance.status === DocumentIssuanceStatus.Ready || issuance.status === DocumentIssuanceStatus.Preview)
      return
    await base.repositories.documentIssuances.forSchool!(work.schoolId).save(issuance.copyWith({
      status: DocumentIssuanceStatus.Failed,
      failureCode: code,
      updatedAt: new Date(),
    }))
  })
}

async function bindArtifact(application: Pick<SchoolApplication, 'forActor'>, work: ClaimedDurableWork, issuance: DocumentIssuance, attachment: Attachment, preview: boolean) {
  const base = application.forActor(createSystemActorMetadata({
    systemId: 'document-render',
    schoolId: work.schoolId,
    requestId: work.id,
    reason: 'durable document render bind',
  })).baseService
  await base.atomicExecution.execute(async () => {
    const current = await base.repositories.documentIssuances.findById(issuance.id)
    if (!current)
      throw new DurableWorkFailure(DOCUMENT_FAILURES.SOURCE_MISSING, true)
    if (current.status === DocumentIssuanceStatus.Ready || current.status === DocumentIssuanceStatus.Preview || current.status === DocumentIssuanceStatus.Voided || current.status === DocumentIssuanceStatus.Superseded)
      return
    const assembled = await assembleDocumentSource(base, assembleInputFromIssuance(current))
    if (assembled.sourceVersion !== current.sourceVersion)
      throw new BusinessRuleViolationError(DOCUMENT_FAILURES.SOURCE_CHANGED, 'Document source changed before the artifact was bound')
    await validateAttachmentSave(attachment, undefined, base.repositories)
    const scope = resourceAccessScope(work.schoolId, 'attachments', [{
      target: { kind: 'school' },
      attachmentOwners: [AttachmentOwnerKind.DocumentIssuance],
      attachmentPurposes: [DOCUMENT_ISSUANCE_PURPOSE],
      attachmentIds: [attachment.id],
    }])
    await base.repositories.attachments.forAccess(scope).save(attachment)
    await base.repositories.privateFiles.retain({
      schoolId: work.schoolId,
      sourceType: DOCUMENT_ISSUANCE_CAPABILITY,
      sourceId: current.id,
      slot: DOCUMENT_ISSUANCE_PURPOSE,
      attachmentId: attachment.id,
      storageKey: attachment.storageKey,
    })
    await base.repositories.documentIssuances.forSchool!(work.schoolId).save(current.copyWith({
      status: preview ? DocumentIssuanceStatus.Preview : DocumentIssuanceStatus.Ready,
      artifactAttachmentId: attachment.id,
      artifactSha256: attachment.checksum,
      artifactSize: attachment.sizeBytes,
      failureCode: undefined,
      updatedAt: new Date(),
    }))
  }, { lockKeys: [`document-issuance:${issuance.id}`] })
}

async function runDocumentRender(application: Pick<SchoolApplication, 'forActor' | 'durableWork'>, work: ClaimedDurableWork, preview = false) {
  if (work.resourceType !== 'document-issuance')
    throw new DurableWorkFailure('DOCUMENT_WORK_INVALID', true)
  const base = application.forActor(createSystemActorMetadata({
    systemId: 'document-render',
    schoolId: work.schoolId,
    requestId: work.id,
    reason: 'durable document render',
  })).baseService
  const issuance = await base.repositories.documentIssuances.findById(work.resourceId)
  if (!issuance)
    throw new DurableWorkFailure(DOCUMENT_FAILURES.SOURCE_MISSING, true)
  if (issuance.status === DocumentIssuanceStatus.Ready || issuance.status === DocumentIssuanceStatus.Preview)
    return
  if (issuance.status === DocumentIssuanceStatus.Voided || issuance.status === DocumentIssuanceStatus.Superseded)
    throw new DurableWorkFailure(DOCUMENT_FAILURES.NOT_RETRYABLE, true)

  await base.atomicExecution.execute(async () => {
    await base.access.documents.assertIssue({
      templateKey: issuance.templateKey,
      sourceId: issuance.sourceId,
      studentId: issuance.studentId,
      classGroupId: issuance.classGroupId,
      academicYearId: issuance.academicYearId,
    })
    const current = await assembleDocumentSource(base, assembleInputFromIssuance(issuance))
    if (current.sourceVersion !== issuance.sourceVersion)
      throw new BusinessRuleViolationError(DOCUMENT_FAILURES.SOURCE_CHANGED, 'Document source changed while rendering')
    await base.repositories.documentIssuances.forSchool!(work.schoolId).save(issuance.copyWith({
      status: DocumentIssuanceStatus.Rendering,
      updatedAt: new Date(),
    }))
  }, { lockKeys: [`document-issuance:${issuance.id}`] })

  const renderer = base.documentRenderer
  if (!renderer)
    throw new DurableWorkFailure(DOCUMENT_FAILURES.RENDER_UNAVAILABLE)
  await application.durableWork.renew(work, 300000)
  const hydrated = await hydrateDocumentPayload(base, issuance, { preview })
  let rendered
  try {
    rendered = await renderer.render(hydrated.input)
  }
  catch (error) {
    throw asFailure(error)
  }
  const attachmentId = crypto.randomUUID()
  const fileName = documentArtifactFileName(issuance)
  const storageKey = buildStorageKey({
    schoolId: work.schoolId,
    purpose: issuance.templateKey === 'incident-report.v1' ? 'generated/incident-report' : 'generated/document',
    ownerKind: AttachmentOwnerKind.DocumentIssuance,
    ownerId: issuance.id,
    attachmentId,
    fileName,
  })
  await application.durableWork.renew(work, 60000)
  let put
  try {
    await base.atomicExecution.execute(async () => {
      await base.repositories.privateFiles.reserve({
        schoolId: work.schoolId,
        storageKey,
        protectedUntil: new Date(Date.now() + 60 * 60 * 1000),
      })
    })
    put = await base.fileStorage.putObject({
      key: storageKey,
      body: rendered.bytes,
      contentType: 'application/pdf',
      metadata: { issuanceId: issuance.id, sha256: rendered.sha256, renderId: rendered.renderId },
    })
  }
  catch {
    throw new DurableWorkFailure(DOCUMENT_FAILURES.STORAGE_UNAVAILABLE)
  }
  const attachment = new Attachment({
    id: attachmentId,
    schoolId: work.schoolId,
    ownerKind: AttachmentOwnerKind.DocumentIssuance,
    ownerId: issuance.id,
    purpose: DOCUMENT_ISSUANCE_PURPOSE,
    fileName,
    storageKey,
    status: AttachmentStatus.Ready,
    checksum: rendered.sha256,
    mimeType: 'application/pdf',
    sizeBytes: put.sizeBytes,
  })
  await bindArtifact(application, work, issuance, attachment, preview)
}

export async function dispatchDocumentRender(application: Pick<SchoolApplication, 'forActor' | 'durableWork'>) {
  try {
    return await runDurableWorkBatch(application.durableWork, {
      [DOCUMENT_RENDER_KIND]: {
        version: 1,
        run: async (work) => {
          try {
            await runDocumentRender(application, work, false)
          }
          catch (error) {
            const failure = asFailure(error)
            await markFailed(application, work, failure.code)
            throw failure
          }
        },
      },
      [DOCUMENT_PREVIEW_KIND]: {
        version: 1,
        run: async (work) => {
          try {
            await runDocumentRender(application, work, true)
          }
          catch (error) {
            const failure = asFailure(error)
            await markFailed(application, work, failure.code)
            throw failure
          }
        },
      },
    }, { leaseMs: 60000 })
  }
  catch (error) {
    if (error instanceof AggregateError)
      throw error
    throw error
  }
}
