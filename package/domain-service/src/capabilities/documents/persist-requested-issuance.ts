import type { DocumentIssuance, DocumentTemplateKey } from '@edaya/core'
import type { BaseSchoolService } from '../../services/base-school-service'
import type { AssembledDocumentSource } from './assemble-document-source'
import type { DocumentLocale } from './catalog'
import { resolveAuditActorId } from '@edaya/authorization'
import {
  BusinessRuleViolationError,
  DOCUMENT_FAILURES,
  DocumentAudience,
  DocumentIssuance as DocumentIssuanceEntity,
  DocumentIssuanceStatus,
  DocumentNumberSeries,
  documentNumberSeriesId,
} from '@edaya/core'
import { getDocumentTemplateCatalogEntry } from './catalog'

export interface PersistRequestedIssuanceInput {
  id?: string
  requestId: string
  templateKey: DocumentTemplateKey
  locale: DocumentLocale
  assembled: AssembledDocumentSource
  preview?: boolean
  replacesIssuanceId?: string
}

export function documentNumberLockKey(schoolId: string, kind: string, academicYearId: string): string {
  return `document-number:${schoolId}:${kind}:${academicYearId}`
}

function issuerAudience(kind: string): DocumentAudience {
  if (kind === 'teacher')
    return DocumentAudience.Teacher
  if (kind === 'guardian' || kind === 'student')
    return DocumentAudience.Family
  return DocumentAudience.Staff
}

async function reserveNumber(base: BaseSchoolService, kind: string, academicYearId: string): Promise<string> {
  const schoolId = base.actor.schoolId
  const seriesId = documentNumberSeriesId(schoolId, kind, academicYearId)
  const store = base.repositories.documentNumberSeries.forSchool!(schoolId)
  const existing = await store.findById(seriesId)
  const next = existing?.nextValue ?? 1
  const year = await base.repositories.academicYears.findById(academicYearId)
  const yearLabel = (year?.name ?? academicYearId).replaceAll(/\s+/g, '')
  const number = `${kind.replaceAll(/[^a-z0-9]+/gi, '').slice(0, 8).toUpperCase()}-${yearLabel}-${String(next).padStart(6, '0')}`
  const series = existing
    ? existing.copyWith({ nextValue: next + 1, updatedAt: new Date() })
    : new DocumentNumberSeries({
        id: seriesId,
        schoolId,
        documentKind: kind,
        academicYearId,
        nextValue: next + 1,
        updatedAt: new Date(),
      })
  await store.save(series)
  return number
}

/** Must run inside the command transaction. */
export async function persistRequestedIssuance(base: BaseSchoolService, input: PersistRequestedIssuanceInput): Promise<DocumentIssuance> {
  const catalog = getDocumentTemplateCatalogEntry(input.templateKey)
  const schoolId = base.actor.schoolId
  const store = base.repositories.documentIssuances.forSchool!(schoolId)
  const duplicates = await store.list({
    templateKey: input.templateKey,
    sourceId: input.assembled.sourceId,
    requestId: input.requestId,
  })
  const existing = duplicates[0]
  if (existing) {
    if (existing.sourceVersion !== input.assembled.sourceVersion || existing.locale !== input.locale)
      throw new BusinessRuleViolationError(DOCUMENT_FAILURES.INPUT_CONFLICT, 'This request identity already used different document input')
    return existing
  }

  const number = catalog.numberingKind && !input.preview
    ? await reserveNumber(base, catalog.numberingKind, input.assembled.academicYearId)
    : undefined
  const issuance = new DocumentIssuanceEntity({
    id: input.id ?? crypto.randomUUID(),
    schoolId,
    templateKey: input.templateKey,
    templateVersion: catalog.templateVersion,
    locale: input.locale,
    academicYearId: input.assembled.academicYearId,
    sourceType: input.assembled.sourceType,
    sourceId: input.assembled.sourceId,
    sourceVersion: input.assembled.sourceVersion,
    studentId: input.assembled.studentId,
    classGroupId: input.assembled.classGroupId,
    snapshot: input.assembled.snapshot,
    issuerActorId: resolveAuditActorId(base.actor),
    audience: issuerAudience(base.actor.kind),
    requestId: input.requestId,
    number,
    status: input.preview ? DocumentIssuanceStatus.Requested : DocumentIssuanceStatus.Requested,
    replacesIssuanceId: input.replacesIssuanceId,
  })
  await store.save(issuance)
  if (input.replacesIssuanceId) {
    const prior = await store.findById(input.replacesIssuanceId)
    if (prior)
      await store.save(prior.copyWith({ status: DocumentIssuanceStatus.Superseded, replacedByIssuanceId: issuance.id, updatedAt: new Date() }))
  }
  return issuance
}

export function documentRenderOutbox(issuance: DocumentIssuance, preview = false) {
  return [{
    id: issuance.id,
    kind: preview ? 'document.preview' : 'document.render',
    version: 1,
    resourceType: 'document-issuance',
    resourceId: issuance.id,
  }] as const
}
