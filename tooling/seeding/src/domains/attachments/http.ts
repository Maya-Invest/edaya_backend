import type { HttpSeedClient } from '../../http/client'
import type { CoreHttpRequestOptions } from '../../http/core-entity'
import type { AttachmentsSeedPort } from './port'
import { postEntitySave } from '../../http/core-entity'
import { withSeedPortError } from '../../support/seed-port-error'

export interface CreateHttpAttachmentsSeedPortOptions {
  client: HttpSeedClient
  serviceAccountApiKey?: string
}

export function createHttpAttachmentsSeedPort(
  options: CreateHttpAttachmentsSeedPortOptions,
): AttachmentsSeedPort {
  const requestOptions: CoreHttpRequestOptions = {
    client: options.client,
    serviceAccountApiKey: options.serviceAccountApiKey,
    requestId: 'http-attachments-seed',
  }

  return {
    saveAttachment: record => withSeedPortError('attachments.saveAttachment', async () => {
      await postEntitySave(requestOptions, 'attachments', record)
    }),
  }
}
