import type { SeedApplication } from '../../../support/types'
import type { ActivitiesSeedPort } from '../port'
import { Activity, ActivityEnrollment, ClassActivityEnrollment } from '@edaya/core'
import { createInProcessSeedService } from '../../../support/in-process-seed-service'
import { withSeedPortError } from '../../../support/seed-port-error'

export function createInProcessActivitiesSeedPort(
  application: SeedApplication,
): ActivitiesSeedPort {
  const service = createInProcessSeedService(application, 'dev-activities-seed')

  return {
    saveActivity: record => withSeedPortError('activities.saveActivity', async () => {
      await service.baseService.entities.activities.save(new Activity({
        ...record,
        startDate: new Date(record.startDate),
        endDate: new Date(record.endDate),
      }), { moduleChecked: true })
    }),
    saveEnrollment: record => withSeedPortError('activities.saveEnrollment', async () => {
      await service.baseService.entities.activityEnrollments.save(new ActivityEnrollment(record), {
        moduleChecked: true,
      })
    }),
    saveClassActivityEnrollment: record => withSeedPortError('activities.saveClassActivityEnrollment', async () => {
      await service.baseService.entities.classActivityEnrollments.save(new ClassActivityEnrollment({
        ...record,
        createdAt: new Date(),
      }), { moduleChecked: true })
    }),
  }
}
