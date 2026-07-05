import type { HttpSeedClient } from '../../../transport/http/client'
import type { CoreHttpRequestOptions } from '../../../transport/http/core-entity'
import type { AttachmentsSeedPort } from '../port'
import { withSeedPortError } from '../../../support/seed-port-error'
import { postCoreCommand } from '../../../transport/http/core-entity'

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
      await postCoreCommand(requestOptions, 'registerAttachment', record)
    }),
  }
}
