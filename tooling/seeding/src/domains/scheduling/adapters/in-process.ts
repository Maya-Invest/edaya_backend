import type { SeedApplication } from '../../../support/types'
import type { SchedulingSeedPort } from '../port'
import { Resource } from '@edaya/core'
import { createInProcessSeedService } from '../../../support/in-process-seed-service'
import { withSeedPortError } from '../../../support/seed-port-error'

export function createInProcessSchedulingSeedPort(
  application: SeedApplication,
): SchedulingSeedPort {
  const service = createInProcessSeedService(application, 'dev-scheduling-seed')

  return {
    saveResource: record => withSeedPortError('scheduling.saveResource', async () => {
      await service.baseService.entities.resources.save(new Resource(record))
    }),
    createSchedule: record => withSeedPortError('scheduling.createSchedule', async () => {
      await service.schedulingWorkflow.createSchedule(record)
    }),
    materializeSchedule: input => withSeedPortError('scheduling.materializeSchedule', async () => {
      await service.schedulingWorkflow.materializeSchedule(input)
    }),
    assignStaffToLessonSession: record => withSeedPortError('scheduling.assignStaffToLessonSession', async () => {
      await service.setupWorkflow.assignStaffToLessonSession(record)
    }),
    assignResourceToClass: record => withSeedPortError('scheduling.assignResourceToClass', async () => {
      await service.setupWorkflow.assignResourceToClass(record)
    }),
    assignResourceToLessonSession: record => withSeedPortError('scheduling.assignResourceToLessonSession', async () => {
      await service.setupWorkflow.assignResourceToLessonSession(record)
    }),
    recordLessonSessionProgress: record => withSeedPortError('scheduling.recordLessonSessionProgress', async () => {
      await service.academicsWorkflow.recordLessonSessionProgress({
        ...record,
        recordedAt: new Date(record.recordedAt),
      })
    }),
  }
}
