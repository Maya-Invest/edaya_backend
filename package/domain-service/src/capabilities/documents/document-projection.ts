import type { DocumentIssuance } from '@edaya/core'
import type { DocumentLocale } from './catalog'
import { documentTemplateTitle } from './catalog'

export interface DocumentIssuanceProjection {
  id: string
  templateKey: DocumentIssuance['templateKey']
  templateVersion: string
  title: string
  locale: DocumentLocale
  academicYearId: string
  sourceType: DocumentIssuance['sourceType']
  sourceId: string
  sourceVersion: string
  studentId?: string
  classGroupId?: string
  number?: string
  status: DocumentIssuance['status']
  artifactAttachmentId?: string
  failureCode?: string
  replacesIssuanceId?: string
  replacedByIssuanceId?: string
  voidedAt?: string
  voidReason?: string
  createdAt: string
  familyDownload: boolean
}

export function projectDocumentIssuance(issuance: DocumentIssuance): DocumentIssuanceProjection {
  return {
    id: issuance.id,
    templateKey: issuance.templateKey,
    templateVersion: issuance.templateVersion,
    title: documentTemplateTitle(issuance.templateKey, issuance.locale),
    locale: issuance.locale,
    academicYearId: issuance.academicYearId,
    sourceType: issuance.sourceType,
    sourceId: issuance.sourceId,
    sourceVersion: issuance.sourceVersion,
    studentId: issuance.studentId,
    classGroupId: issuance.classGroupId,
    number: issuance.number,
    status: issuance.status,
    artifactAttachmentId: issuance.artifactAttachmentId,
    failureCode: issuance.failureCode,
    replacesIssuanceId: issuance.replacesIssuanceId,
    replacedByIssuanceId: issuance.replacedByIssuanceId,
    voidedAt: issuance.voidedAt?.toISOString(),
    voidReason: issuance.voidReason,
    createdAt: issuance.createdAt.toISOString(),
    familyDownload: issuance.isFamilyCurrent,
  }
}

export function documentArtifactFileName(issuance: DocumentIssuance): string {
  const title = documentTemplateTitle(issuance.templateKey, issuance.locale).replaceAll(/[^\p{L}\p{N}]+/gu, '-')
  return `${title}${issuance.number ? `-${issuance.number}` : ''}.pdf`
}
