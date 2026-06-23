import type { SeedApplication } from '../types'
import type { SchoolLifeSeedPort } from './port'
import { createInProcessSeedService } from '../in-process-seed-service'
import { withSeedPortError } from '../seed-port-error'

export function createInProcessSchoolLifeSeedPort(
  application: SeedApplication,
): SchoolLifeSeedPort {
  const service = createInProcessSeedService(application, 'dev-school-life-seed')

  return {
    createCalendarEvent: record => withSeedPortError('schoolLife.createCalendarEvent', async () => {
      await service.schedulingWorkflow.createCalendarEvent({
        ...record,
        startDate: new Date(record.startDate),
        endDate: new Date(record.endDate),
      })
    }),
    recordIncident: record => withSeedPortError('schoolLife.recordIncident', async () => {
      await service.behaviorWorkflow.recordIncident({
        ...record,
        date: new Date(record.date),
      })
    }),
    addStudentInvolvement: record =>
      withSeedPortError('schoolLife.addStudentInvolvement', async () => {
        await service.behaviorWorkflow.addStudentInvolvement(record)
      }),
  }
}
