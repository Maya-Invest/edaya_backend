import type { HttpSeedClient } from '../../../transport/http/client'
import type { CoreHttpRequestOptions } from '../../../transport/http/core-entity'
import type { CommunicationsSeedPort } from '../port'
import { withSeedPortError } from '../../../support/seed-port-error'
import { postCoreCommand, postEntityFindById, postEntityFindOne } from '../../../transport/http/core-entity'
import { seedDeliveryEvents } from '../delivery-history'

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
    findRecipientSubjectId: async (kind, id) => {
      const resource = ({ staff: 'staffMembers', guardian: 'guardians', student: 'students', teacher: 'teachers' } as const)[kind]
      const profile = await postEntityFindById(requestOptions, resource, id)
      return profile && typeof profile === 'object' && 'subjectId' in profile && typeof profile.subjectId === 'string' ? profile.subjectId : undefined
    },
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
      const existing = await postEntityFindOne(requestOptions, 'messageDeliveries', {
        schoolId: record.schoolId,
        sourceKey: record.announcementId,
        subjectId: record.subjectId,
        recipientKind: record.recipientKind,
        recipientId: record.recipientId,
      })
      if (existing && typeof existing === 'object' && 'id' in existing && typeof existing.id === 'string') {
        const existingSentAt = 'sentAt' in existing && (typeof existing.sentAt === 'string' || existing.sentAt instanceof Date)
          ? existing.sentAt
          : undefined
        for (const event of seedDeliveryEvents(record, existingSentAt))
          await postCoreCommand(requestOptions, 'applyDeliveryEvent', { ...event, deliveryId: existing.id })
        return
      }
      await postCoreCommand(requestOptions, 'recordDelivery', record)
    }),
  }
}
