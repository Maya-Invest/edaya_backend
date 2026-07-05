import type { HttpSeedClient } from '../../../transport/http/client'
import type { CoreHttpRequestOptions } from '../../../transport/http/core-entity'
import type { CommunicationsSeedPort } from '../port'
import { withSeedPortError } from '../../../support/seed-port-error'
import { postCoreCommand } from '../../../transport/http/core-entity'

export interface CreateHttpCommunicationsSeedPortOptions {
  client: HttpSeedClient
  serviceAccountApiKey?: string
}

export function createHttpCommunicationsSeedPort(
  options: CreateHttpCommunicationsSeedPortOptions,
): CommunicationsSeedPort {
  const requestOptions: CoreHttpRequestOptions = {
    client: options.client,
    serviceAccountApiKey: options.serviceAccountApiKey,
    requestId: 'http-communications-seed',
  }

  return {
    createAnnouncement: record => withSeedPortError('communications.createAnnouncement', async () => {
      await postCoreCommand(requestOptions, 'createAnnouncement', record)
    }),
    addTarget: record => withSeedPortError('communications.addTarget', async () => {
      await postCoreCommand(requestOptions, 'addTarget', record)
    }),
    publishAnnouncement: record =>
      withSeedPortError('communications.publishAnnouncement', async () => {
        await postCoreCommand(requestOptions, 'publishAnnouncement', record)
      }),
    materializeDeliveries: record =>
      withSeedPortError('communications.materializeDeliveries', async () => {
        const deliveries = await postCoreCommand(requestOptions, 'materializeDeliveries', record)
        return Array.isArray(deliveries) ? deliveries.length : 0
      }),
    recordDelivery: record => withSeedPortError('communications.recordDelivery', async () => {
      await postCoreCommand(requestOptions, 'recordDelivery', record)
    }),
  }
}
