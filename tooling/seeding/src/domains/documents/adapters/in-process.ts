import type { SchoolApplication } from '@edaya/service'
import type { SeedApplication } from '../../../support/types'
import type { DocumentIssuanceSeedRecord, DocumentsSeedPort } from '../port'
import {
  DocumentAudience,
  DocumentIssuance,
  DocumentIssuanceStatus,
  DocumentSourceType,
  isDocumentTemplateKey,
} from '@edaya/core'
import { dispatchDocumentRender } from '@edaya/service'
import { createInProcessSeedService } from '../../../support/in-process-seed-service'
import { withSeedPortError } from '../../../support/seed-port-error'

export function createInProcessDocumentsSeedPort(
  application: SeedApplication,
): DocumentsSeedPort {
  const service = createInProcessSeedService(application, 'dev-documents-seed')

  return {
    requestIssuance: record => withSeedPortError('documents.requestIssuance', async () => {
      await requestSeedIssuance(service, record)
    }),
    saveFailedIssuance: record => withSeedPortError('documents.saveFailedIssuance', async () => {
      const schoolId = service.baseService.actor.schoolId
      await service.baseService.repositories.documentIssuances.forSchool!(schoolId).save(new DocumentIssuance({
        id: record.id,
        schoolId,
        templateKey: record.templateKey,
        templateVersion: '1.0.0',
        locale: record.locale ?? 'fr',
        academicYearId: record.academicYearId,
        sourceType: sourceTypeFor(record.templateKey),
        sourceId: record.sourceId,
        sourceVersion: 'seed-failed',
        studentId: record.studentId,
        classGroupId: record.classGroupId,
        snapshot: {
          facts: { documentTitle: record.templateKey },
          sourceVersion: 'seed-failed',
          locale: record.locale ?? 'fr',
          timeZone: 'UTC',
        },
        issuerActorId: 'fixture-seed',
        audience: DocumentAudience.Staff,
        requestId: record.requestId,
        status: DocumentIssuanceStatus.Failed,
        failureCode: record.failureCode ?? 'DOCUMENT_RENDER_UNAVAILABLE',
      }))
    }),
    dispatchRender: () => withSeedPortError('documents.dispatchRender', async () => {
      await dispatchDocumentRender(application as SchoolApplication)
    }),
  }
}

function sourceTypeFor(templateKey: DocumentIssuanceSeedRecord['templateKey']): DocumentSourceType {
  if (templateKey === 'report-card.v1')
    return DocumentSourceType.ReportCardResult
  if (templateKey === 'receipt.v1')
    return DocumentSourceType.Payment
  return DocumentSourceType.Enrollment
}

async function requestSeedIssuance(
  service: ReturnType<typeof createInProcessSeedService>,
  record: DocumentIssuanceSeedRecord,
) {
  if (!isDocumentTemplateKey(record.templateKey))
    return
  await service.documentsWorkflow.requestDocumentIssuance({
    id: record.id,
    requestId: record.requestId,
    templateKey: record.templateKey,
    sourceId: record.sourceId,
    studentId: record.studentId,
    classGroupId: record.classGroupId,
    academicYearId: record.academicYearId,
    locale: record.locale ?? 'fr',
    staffFields: record.staffFields,
  })
}
