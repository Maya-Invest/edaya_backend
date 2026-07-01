import type { SeedApplication } from '../../support/types'
import type { SchedulingSeedPort } from './port'
import { Resource } from '@edaya/core'
import { createInProcessSeedService } from '../../support/in-process-seed-service'
import { withSeedPortError } from '../../support/seed-port-error'

export function createInProcessSchedulingSeedPort(
  application: SeedApplication,
): SchedulingSeedPort {
  const service = createInProcessSeedService(application, 'dev-scheduling-seed')

  return {
    saveResource: record => withSeedPortError('scheduling.saveResource', async () => {
      await service.baseService.entities.resources.save(new Resource(record), { moduleChecked: true })
    }),
    createSchedule: record => withSeedPortError('scheduling.createSchedule', async () => {
      await service.schedulingWorkflow.createSchedule(record)
    }),
    createSession: record => withSeedPortError('scheduling.createSession', async () => {
      await service.schedulingWorkflow.createSession({
        ...record,
        startsAt: new Date(record.startsAt),
        endsAt: new Date(record.endsAt),
      })
    }),
    assignStaffToSession: record => withSeedPortError('scheduling.assignStaffToSession', async () => {
      await service.setupWorkflow.assignStaffToSession(record)
    }),
    assignResourceToSession: record => withSeedPortError('scheduling.assignResourceToSession', async () => {
      await service.setupWorkflow.assignResourceToSession(record)
    }),
    recordSessionProgress: record => withSeedPortError('scheduling.recordSessionProgress', async () => {
      await service.academicsWorkflow.recordSessionProgress({
        ...record,
        recordedAt: new Date(record.recordedAt),
      })
    }),
  }
}
