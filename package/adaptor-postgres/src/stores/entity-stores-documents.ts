import type { DocumentIssuance } from '@edaya/core'
import type { EntityStores } from './entity-stores-types'
import {
  DocumentAudience,
  DocumentIssuance as DocumentIssuanceCtor,
  DocumentIssuanceStatus,
  DocumentNumberSeries as DocumentNumberSeriesCtor,
  DocumentSourceType,
} from '@edaya/core'
import { deserializeJsonb } from '../lib/mappers'
import { customStore, defaultStore } from '../lib/store-factory'
import * as schema from '../postgres-schema'
import { enumValue } from './entity-store-helpers'

export function createDocumentsEntityStores(db: any): Pick<EntityStores, 'documentIssuances'> {
  return {
    documentIssuances: customStore(
      db,
      schema.documentIssuances,
      (entity: DocumentIssuance) => ({
        id: entity.id,
        schoolId: entity.schoolId,
        templateKey: entity.templateKey,
        templateVersion: entity.templateVersion,
        locale: entity.locale,
        academicYearId: entity.academicYearId,
        sourceType: entity.sourceType,
        sourceId: entity.sourceId,
        sourceVersion: entity.sourceVersion,
        studentId: entity.studentId ?? null,
        classGroupId: entity.classGroupId ?? null,
        snapshot: entity.snapshot,
        issuerActorId: entity.issuerActorId,
        audience: entity.audience,
        requestId: entity.requestId,
        number: entity.number ?? null,
        status: entity.status,
        artifactAttachmentId: entity.artifactAttachmentId ?? null,
        artifactSha256: entity.artifactSha256 ?? null,
        artifactSize: entity.artifactSize ?? null,
        replacesIssuanceId: entity.replacesIssuanceId ?? null,
        replacedByIssuanceId: entity.replacedByIssuanceId ?? null,
        voidedAt: entity.voidedAt ?? null,
        voidReason: entity.voidReason ?? null,
        failureCode: entity.failureCode ?? null,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt ?? null,
      }),
      (row: any) => new DocumentIssuanceCtor({
        id: row.id,
        schoolId: row.schoolId,
        templateKey: row.templateKey,
        templateVersion: row.templateVersion,
        locale: row.locale,
        academicYearId: row.academicYearId,
        sourceType: enumValue(DocumentSourceType, row.sourceType, 'documentIssuances.sourceType'),
        sourceId: row.sourceId,
        sourceVersion: row.sourceVersion,
        studentId: row.studentId,
        classGroupId: row.classGroupId,
        snapshot: deserializeJsonb(row.snapshot),
        issuerActorId: row.issuerActorId,
        audience: enumValue(DocumentAudience, row.audience, 'documentIssuances.audience'),
        requestId: row.requestId,
        number: row.number,
        status: enumValue(DocumentIssuanceStatus, row.status, 'documentIssuances.status'),
        artifactAttachmentId: row.artifactAttachmentId,
        artifactSha256: row.artifactSha256,
        artifactSize: row.artifactSize,
        replacesIssuanceId: row.replacesIssuanceId,
        replacedByIssuanceId: row.replacedByIssuanceId,
        voidedAt: row.voidedAt,
        voidReason: row.voidReason,
        failureCode: row.failureCode,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }),
    ),
  }
}

export function createDocumentNumberSeriesStore(db: any) {
  return defaultStore(db, schema.documentNumberSeries, DocumentNumberSeriesCtor)
}
