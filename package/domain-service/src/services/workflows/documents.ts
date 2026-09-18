import type { CommandJson, DocumentIssuance, DocumentTemplateKey, PresignedDownload } from '@edaya/core'
import type { AssembleDocumentInput } from '../../capabilities/documents/assemble-document-source'
import type { DocumentLocale } from '../../capabilities/documents/catalog'
import type { DocumentIssuanceProjection } from '../../capabilities/documents/document-projection'
import type { AttachmentReadPolicy } from '../../capabilities/files/attachment-purpose-access'
import type { BaseSchoolService } from '../base-school-service'
import type { SchoolCommandKey } from '../runtime/school-command-catalog'
import { denyResourceAccess, resolveAuditActorId } from '@edaya/authorization'
import {
  BusinessRuleViolationError,
  DOCUMENT_BATCH_LIMIT,
  DOCUMENT_FAILURES,
  DocumentIssuanceStatus,
} from '@edaya/core'
import { assembleDocumentSource } from '../../capabilities/documents/assemble-document-source'
import { documentTemplatesVisibleTo, getDocumentTemplateCatalogEntry } from '../../capabilities/documents/catalog'
import { documentArtifactReadPolicy } from '../../capabilities/documents/document-artifact-access'
import { documentArtifactFileName, projectDocumentIssuance } from '../../capabilities/documents/document-projection'
import { DOCUMENT_PREVIEW_KIND, DOCUMENT_RENDER_KIND } from '../../capabilities/documents/durable-document-render'
import { clearSchoolIssuanceAsset, completeSchoolIssuanceAssetUpload, createSchoolIssuanceAssetUpload } from '../../capabilities/documents/issuance-asset-uploads'
import { documentNumberLockKey, documentRenderOutbox, persistRequestedIssuance } from '../../capabilities/documents/persist-requested-issuance'
import { grantAttachmentDownload } from '../../capabilities/files/grant-attachment-download'
import { schoolCommandScope } from '../commands/school-command-scope'
import { BaseServiceWorkflow } from './base-service-workflow'

function fail(code: string, message: string): never {
  throw new BusinessRuleViolationError(code, message)
}

export interface RequestDocumentIssuanceInput {
  id?: string
  requestId: string
  templateKey: DocumentTemplateKey
  sourceId: string
  locale?: DocumentLocale
  academicYearId?: string
  academicPeriodId?: string
  classSubjectId?: string
  studentId?: string
  classGroupId?: string
  teacherId?: string
  staffFields?: { recipient?: string, date?: string, location?: string, reason?: string }
}

export interface RequestDocumentIssuanceBatchInput {
  requestId: string
  templateKey: DocumentTemplateKey
  locale?: DocumentLocale
  academicYearId?: string
  items: readonly {
    sourceId: string
    requestId: string
    studentId?: string
    classGroupId?: string
    teacherId?: string
    academicPeriodId?: string
    classSubjectId?: string
    staffFields?: RequestDocumentIssuanceInput['staffFields']
  }[]
}

export interface RetryDocumentIssuanceInput {
  requestId: string
  issuanceId: string
}

export interface CorrectDocumentIssuanceInput extends RequestDocumentIssuanceInput {
  issuanceId: string
}

export interface VoidDocumentIssuanceInput {
  requestId: string
  issuanceId: string
  reason: string
}

export interface ListDocumentIssuancesInput {
  studentId?: string
  academicYearId?: string
  classGroupId?: string
  templateKey?: DocumentTemplateKey
  sourceId?: string
  status?: DocumentIssuance['status']
}

export interface GrantDocumentBundleInput {
  issuanceIds: readonly string[]
}

export interface DocumentDownloadGrant extends PresignedDownload {
  fileName: string
  issuanceId: string
}

export interface BatchIssuanceItemResult {
  sourceId: string
  requestId: string
  status: 'requested' | 'denied'
  issuanceId?: string
  failureCode?: string
}

export class DocumentsServiceWorkflow extends BaseServiceWorkflow {
  async listDocumentTemplates() {
    return documentTemplatesVisibleTo(this.baseService.actor.kind).map(entry => ({
      templateKey: entry.templateKey,
      templateVersion: entry.templateVersion,
      locales: entry.locales,
      format: entry.format,
      sourceType: entry.sourceType,
      numberingKind: entry.numberingKind,
      familyDownload: entry.familyDownload,
      teacherOperational: entry.teacherOperational,
      titles: entry.titles,
    }))
  }

  async listDocumentIssuances(input: ListDocumentIssuancesInput = {}): Promise<DocumentIssuanceProjection[]> {
    const scope = await this.baseService.access.documents.readScope()
    const rows = await this.baseService.repositories.documentIssuances.forAccess(scope).list({
      ...(input.studentId ? { studentId: input.studentId } : {}),
      ...(input.academicYearId ? { academicYearId: input.academicYearId } : {}),
      ...(input.classGroupId ? { classGroupId: input.classGroupId } : {}),
      ...(input.templateKey ? { templateKey: input.templateKey } : {}),
      ...(input.sourceId ? { sourceId: input.sourceId } : {}),
      ...(input.status ? { status: input.status } : {}),
    })
    return this.visibleIssuances(rows).map(projectDocumentIssuance)
  }

  async getDocumentIssuance(input: { id: string }): Promise<DocumentIssuanceProjection> {
    const issuance = await this.requireIssuance(input.id)
    if (!this.visibleIssuances([issuance]).length)
      denyResourceAccess()
    return projectDocumentIssuance(issuance)
  }

  async grantDocumentDownload(input: { id: string }): Promise<DocumentDownloadGrant> {
    const issuance = await this.requireIssuance(input.id)
    await this.baseService.access.documents.assertDownload(issuance)
    if (!issuance.artifactAttachmentId)
      fail(DOCUMENT_FAILURES.DOWNLOAD_FORBIDDEN, 'Document is not downloadable')
    if (issuance.status !== DocumentIssuanceStatus.Ready && issuance.status !== DocumentIssuanceStatus.Preview)
      fail(DOCUMENT_FAILURES.DOWNLOAD_FORBIDDEN, 'Document is not downloadable')
    if ((this.baseService.actor.kind === 'guardian' || this.baseService.actor.kind === 'student') && !issuance.isFamilyCurrent)
      fail(DOCUMENT_FAILURES.DOWNLOAD_FORBIDDEN, 'This document is not available for family download')
    const grant = await grantAttachmentDownload(this.baseService, issuance.artifactAttachmentId, {
      access: this.documentReadPolicy(issuance),
    })
    if (!grant)
      fail(DOCUMENT_FAILURES.DOWNLOAD_FORBIDDEN, 'Document artifact is not available')
    return { ...grant, fileName: documentArtifactFileName(issuance), issuanceId: issuance.id }
  }

  async grantDocumentBundleDownload(input: GrantDocumentBundleInput): Promise<{ items: DocumentDownloadGrant[] }> {
    if (input.issuanceIds.length > DOCUMENT_BATCH_LIMIT)
      fail(DOCUMENT_FAILURES.BATCH_LIMIT, `Bundle downloads are limited to ${DOCUMENT_BATCH_LIMIT} items`)
    const items: DocumentDownloadGrant[] = []
    for (const id of input.issuanceIds) {
      try {
        items.push(await this.grantDocumentDownload({ id }))
      }
      catch (error) {
        if (error instanceof BusinessRuleViolationError && error.code === DOCUMENT_FAILURES.DOWNLOAD_FORBIDDEN)
          continue
        throw error
      }
    }
    return { items }
  }

  async requestDocumentIssuance(input: RequestDocumentIssuanceInput): Promise<DocumentIssuanceProjection> {
    const locale = input.locale ?? 'fr'
    const assembled = await this.assemble(input, locale)
    const catalog = getDocumentTemplateCatalogEntry(input.templateKey)
    return this.run({
      command: 'requestDocumentIssuance',
      requestId: input.requestId,
      input,
      lockKeys: catalog.numberingKind
        ? [documentNumberLockKey(this.baseService.actor.schoolId, catalog.numberingKind, assembled.academicYearId)]
        : [`document-issuance-request:${input.requestId}`],
      authorize: async () => this.authorizeIssue(input, assembled),
      execute: async () => persistRequestedIssuance(this.baseService, {
        id: input.id,
        requestId: input.requestId,
        templateKey: input.templateKey,
        locale,
        assembled,
      }),
      replay: async stored => this.requireIssuance(stored.id),
      persistResult: result => ({ id: result.id, status: result.status }),
      outbox: result => [...documentRenderOutbox(result)],
    }).then(projectDocumentIssuance)
  }

  async requestDocumentIssuanceBatch(input: RequestDocumentIssuanceBatchInput): Promise<{ items: BatchIssuanceItemResult[] }> {
    if (input.items.length === 0 || input.items.length > DOCUMENT_BATCH_LIMIT)
      fail(DOCUMENT_FAILURES.BATCH_LIMIT, `Document batches must contain 1 to ${DOCUMENT_BATCH_LIMIT} items`)
    const items: BatchIssuanceItemResult[] = []
    for (const item of input.items) {
      try {
        const issuance = await this.requestDocumentIssuance({
          requestId: item.requestId,
          templateKey: input.templateKey,
          sourceId: item.sourceId,
          locale: input.locale,
          academicYearId: input.academicYearId,
          academicPeriodId: item.academicPeriodId,
          classSubjectId: item.classSubjectId,
          studentId: item.studentId,
          classGroupId: item.classGroupId,
          teacherId: item.teacherId,
          staffFields: item.staffFields,
        })
        items.push({ sourceId: item.sourceId, requestId: item.requestId, status: 'requested', issuanceId: issuance.id })
      }
      catch (error) {
        items.push({
          sourceId: item.sourceId,
          requestId: item.requestId,
          status: 'denied',
          failureCode: error instanceof BusinessRuleViolationError ? error.code : 'DOCUMENT_SOURCE_INACCESSIBLE',
        })
      }
    }
    return { items }
  }

  async retryDocumentIssuance(input: RetryDocumentIssuanceInput): Promise<DocumentIssuanceProjection> {
    const issuance = await this.requireIssuance(input.issuanceId)
    if (issuance.status !== DocumentIssuanceStatus.Failed)
      fail(DOCUMENT_FAILURES.NOT_RETRYABLE, 'Only failed issuances can be retried')
    const assembled = await this.assemble({
      requestId: issuance.requestId,
      templateKey: issuance.templateKey,
      sourceId: issuance.sourceId,
      locale: issuance.locale,
      academicYearId: issuance.academicYearId,
      studentId: issuance.studentId,
      classGroupId: issuance.classGroupId,
    }, issuance.locale)
    if (assembled.sourceVersion !== issuance.sourceVersion)
      fail(DOCUMENT_FAILURES.INPUT_CONFLICT, 'Retry requires unchanged document input')
    return this.run({
      command: 'retryDocumentIssuance',
      requestId: input.requestId,
      input,
      lockKeys: [`document-issuance:${issuance.id}`],
      authorize: async () => this.baseService.access.documents.assertIssue({
        templateKey: issuance.templateKey,
        sourceId: issuance.sourceId,
        studentId: issuance.studentId,
        classGroupId: issuance.classGroupId,
        academicYearId: issuance.academicYearId,
      }),
      execute: async () => {
        const retried = issuance.copyWith({ status: DocumentIssuanceStatus.Requested, failureCode: undefined, updatedAt: new Date() })
        await this.baseService.repositories.documentIssuances.forSchool!(issuance.schoolId).save(retried)
        return retried
      },
      replay: async stored => this.requireIssuance(stored.id),
      persistResult: result => ({ id: result.id, status: result.status }),
      outbox: result => [{ id: `${result.id}:${input.requestId}`, kind: DOCUMENT_RENDER_KIND, version: 1, resourceType: 'document-issuance', resourceId: result.id }],
    }).then(projectDocumentIssuance)
  }

  async correctDocumentIssuance(input: CorrectDocumentIssuanceInput): Promise<DocumentIssuanceProjection> {
    const prior = await this.requireIssuance(input.issuanceId)
    if (prior.status !== DocumentIssuanceStatus.Ready && prior.status !== DocumentIssuanceStatus.Failed)
      fail(DOCUMENT_FAILURES.NOT_CORRECTABLE, 'Only issued or failed documents can be corrected')
    const locale = input.locale ?? prior.locale
    const assembled = await this.assemble(input, locale)
    const catalog = getDocumentTemplateCatalogEntry(input.templateKey)
    return this.run({
      command: 'correctDocumentIssuance',
      requestId: input.requestId,
      input,
      lockKeys: catalog.numberingKind
        ? [documentNumberLockKey(this.baseService.actor.schoolId, catalog.numberingKind, assembled.academicYearId), `document-issuance:${prior.id}`]
        : [`document-issuance:${prior.id}`],
      authorize: async () => {
        await this.baseService.access.documents.assertVoid(prior)
        await this.authorizeIssue(input, assembled)
      },
      execute: async () => persistRequestedIssuance(this.baseService, {
        requestId: input.requestId,
        templateKey: input.templateKey,
        locale,
        assembled,
        replacesIssuanceId: prior.id,
      }),
      replay: async stored => this.requireIssuance(stored.id),
      persistResult: result => ({ id: result.id, status: result.status }),
      outbox: result => [...documentRenderOutbox(result)],
    }).then(projectDocumentIssuance)
  }

  async voidDocumentIssuance(input: VoidDocumentIssuanceInput): Promise<DocumentIssuanceProjection> {
    const issuance = await this.requireIssuance(input.issuanceId)
    if (issuance.status === DocumentIssuanceStatus.Voided)
      fail(DOCUMENT_FAILURES.NOT_VOIDABLE, 'Document is already voided')
    return this.run({
      command: 'voidDocumentIssuance',
      requestId: input.requestId,
      input,
      lockKeys: [`document-issuance:${issuance.id}`],
      authorize: async () => this.baseService.access.documents.assertVoid(issuance),
      execute: async () => {
        const voided = issuance.copyWith({
          status: DocumentIssuanceStatus.Voided,
          voidedAt: new Date(),
          voidReason: input.reason,
          updatedAt: new Date(),
        })
        await this.baseService.repositories.documentIssuances.forSchool!(issuance.schoolId).save(voided)
        return voided
      },
      replay: async stored => this.requireIssuance(stored.id),
      persistResult: result => ({ id: result.id, status: result.status }),
    }).then(projectDocumentIssuance)
  }

  async previewDocument(input: RequestDocumentIssuanceInput): Promise<DocumentIssuanceProjection> {
    if (this.baseService.actor.kind !== 'staff' && this.baseService.actor.kind !== 'system')
      denyResourceAccess()
    const locale = input.locale ?? 'fr'
    const assembled = await this.assemble({ ...input }, locale, true)
    return this.run({
      command: 'previewDocument',
      requestId: input.requestId,
      input,
      lockKeys: [`document-preview:${input.requestId}`],
      authorize: async () => this.authorizeIssue(input, assembled),
      execute: async () => persistRequestedIssuance(this.baseService, {
        requestId: input.requestId,
        templateKey: input.templateKey,
        locale,
        assembled,
        preview: true,
      }),
      replay: async stored => this.requireIssuance(stored.id),
      persistResult: result => ({ id: result.id, status: result.status }),
      outbox: result => [{ id: result.id, kind: DOCUMENT_PREVIEW_KIND, version: 1, resourceType: 'document-issuance', resourceId: result.id }],
    }).then(projectDocumentIssuance)
  }

  async enqueueBulletinForPublishedResult(input: { resultId: string, studentId: string, locale?: DocumentLocale, requestId?: string }) {
    const locale = input.locale ?? 'fr'
    const assembled = await assembleDocumentSource(this.baseService, {
      templateKey: 'report-card.v1',
      sourceId: input.resultId,
      locale,
      studentId: input.studentId,
    })
    return persistRequestedIssuance(this.baseService, {
      requestId: input.requestId ?? `bulletin:${input.resultId}`,
      templateKey: 'report-card.v1',
      locale,
      assembled,
    })
  }

  createSchoolIssuanceAssetUpload(input: Parameters<typeof createSchoolIssuanceAssetUpload>[1]) {
    return createSchoolIssuanceAssetUpload(this.baseService, input)
  }

  completeSchoolIssuanceAssetUpload(input: Parameters<typeof completeSchoolIssuanceAssetUpload>[1]) {
    return completeSchoolIssuanceAssetUpload(this.baseService, input)
  }

  clearSchoolIssuanceAsset(input: Parameters<typeof clearSchoolIssuanceAsset>[1]) {
    return clearSchoolIssuanceAsset(this.baseService, input)
  }

  private visibleIssuances(rows: readonly DocumentIssuance[]): DocumentIssuance[] {
    const actor = this.baseService.actor
    if (actor.kind === 'guardian' || actor.kind === 'student') {
      return rows.filter((row) => {
        const catalog = getDocumentTemplateCatalogEntry(row.templateKey)
        return catalog.familyDownload && row.isFamilyCurrent
      })
    }
    if (actor.kind === 'teacher') {
      return rows.filter((row) => {
        const catalog = getDocumentTemplateCatalogEntry(row.templateKey)
        return catalog.teacherOperational && row.status === DocumentIssuanceStatus.Ready
      })
    }
    return [...rows]
  }

  private async requireIssuance(id: string): Promise<DocumentIssuance> {
    const scope = await this.baseService.access.documents.readScope()
    const issuance = await this.baseService.repositories.documentIssuances.forAccess(scope).findById(id)
    if (!issuance)
      denyResourceAccess()
    return issuance
  }

  private async assemble(input: RequestDocumentIssuanceInput, locale: DocumentLocale, preview = false) {
    const assembleInput: AssembleDocumentInput = {
      templateKey: input.templateKey,
      sourceId: input.sourceId,
      locale,
      academicYearId: input.academicYearId,
      academicPeriodId: input.academicPeriodId,
      classSubjectId: input.classSubjectId,
      studentId: input.studentId,
      classGroupId: input.classGroupId,
      teacherId: input.teacherId,
      staffFields: input.staffFields,
      preview,
    }
    return assembleDocumentSource(this.baseService, assembleInput)
  }

  private async authorizeIssue(input: RequestDocumentIssuanceInput, assembled: Awaited<ReturnType<typeof assembleDocumentSource>>) {
    await this.baseService.access.documents.assertIssue({
      templateKey: input.templateKey,
      sourceId: assembled.sourceId,
      studentId: assembled.studentId ?? input.studentId,
      classGroupId: assembled.classGroupId ?? input.classGroupId,
      teacherId: input.teacherId,
      academicYearId: assembled.academicYearId,
    })
  }

  private documentReadPolicy(issuance: DocumentIssuance): AttachmentReadPolicy {
    return documentArtifactReadPolicy(this.baseService, issuance)
  }

  private async run<Result extends DocumentIssuance, Stored extends CommandJson & { id: string } = { id: string, status: string }>(options: {
    command: SchoolCommandKey
    requestId: string
    input: unknown
    lockKeys: string[]
    authorize: () => Promise<void>
    execute: () => Promise<Result>
    replay: (stored: Stored) => Promise<Result>
    persistResult: (result: Result) => Stored
    outbox?: (result: Result) => readonly { id: string, kind: string, version: number, resourceType: string, resourceId: string }[]
  }): Promise<Result> {
    return this.baseService.commandExecution.execute<Result, Stored>({
      scope: await schoolCommandScope(this.baseService.actor, options.command, options.requestId),
      input: options.input,
      resultMode: 'ordinary',
      lockKeys: options.lockKeys,
      authorize: options.authorize,
      execute: options.execute,
      replay: stored => options.replay(stored),
      persistResult: result => options.persistResult(result),
      audit: (result) => {
        const stored = options.persistResult(result)
        return [{ event: options.command, resourceType: 'document-issuance', resourceId: stored.id }]
      },
      outbox: options.outbox,
    })
  }
}

export function documentIssuerId(base: BaseSchoolService): string {
  return resolveAuditActorId(base.actor)
}
