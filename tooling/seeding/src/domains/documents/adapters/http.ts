import type { HttpSeedClient } from '../../../transport/http/client'
import type { CoreHttpRequestOptions } from '../../../transport/http/core-entity'
import type { DocumentsSeedPort } from '../port'
import { withSeedPortError } from '../../../support/seed-port-error'
import { postCoreCommand } from '../../../transport/http/core-entity'

export interface CreateHttpDocumentsSeedPortOptions {
  client: HttpSeedClient
  serviceAccountApiKey?: string
}

export function createHttpDocumentsSeedPort(
  options: CreateHttpDocumentsSeedPortOptions,
): DocumentsSeedPort {
  const requestOptions: CoreHttpRequestOptions = {
    client: options.client,
    serviceAccountApiKey: options.serviceAccountApiKey,
    requestId: 'http-documents-seed',
  }

  return {
    requestIssuance: record => withSeedPortError('documents.requestIssuance', async () => {
      await postCoreCommand(requestOptions, 'requestDocumentIssuance', {
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
    }),
    saveFailedIssuance: record => withSeedPortError('documents.saveFailedIssuance', async () => {
      await postCoreCommand(requestOptions, 'requestDocumentIssuance', {
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
    }),
    dispatchRender: async () => {},
  }
}
