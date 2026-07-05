import type { SeedApplication } from '../../../support/types'
import type { CommunicationsSeedPort } from '../port'
import { createInProcessSeedService } from '../../../support/in-process-seed-service'
import { withSeedPortError } from '../../../support/seed-port-error'

export function createInProcessCommunicationsSeedPort(
  application: SeedApplication,
): CommunicationsSeedPort {
  const service = createInProcessSeedService(application, 'dev-communications-seed')

  return {
    createAnnouncement: record => withSeedPortError('communications.createAnnouncement', async () => {
      await service.communicationsWorkflow.createAnnouncement({
        ...record,
        createdAt: new Date(record.createdAt),
        publishedAt: record.publishedAt ? new Date(record.publishedAt) : undefined,
        expiresAt: record.expiresAt ? new Date(record.expiresAt) : undefined,
      })
    }),
    addTarget: record => withSeedPortError('communications.addTarget', async () => {
      await service.communicationsWorkflow.addTarget(record)
    }),
    publishAnnouncement: record =>
      withSeedPortError('communications.publishAnnouncement', async () => {
        await service.communicationsWorkflow.publishAnnouncement({
          ...record,
          publishedAt: record.publishedAt ? new Date(record.publishedAt) : undefined,
        })
      }),
    materializeDeliveries: record =>
      withSeedPortError('communications.materializeDeliveries', async () => {
        const deliveries = await service.communicationsWorkflow.materializeDeliveries(record)
        return deliveries.length
      }),
    recordDelivery: record => withSeedPortError('communications.recordDelivery', async () => {
      await service.communicationsWorkflow.recordDelivery({
        ...record,
        sentAt: record.sentAt ? new Date(record.sentAt) : undefined,
        readAt: record.readAt ? new Date(record.readAt) : undefined,
      })
    }),
  }
}
