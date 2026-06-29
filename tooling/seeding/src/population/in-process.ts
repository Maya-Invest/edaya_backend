import type { SeedApplication } from '../types'
import type { PopulationSeedPort } from './port'
import { createInProcessSeedService } from '../in-process-seed-service'
import { withSeedPortError } from '../seed-port-error'

export function createInProcessPopulationSeedPort(
  application: SeedApplication,
): PopulationSeedPort {
  const service = createInProcessSeedService(application, 'dev-population-seed')

  return {
    registerStudent: record => withSeedPortError('population.registerStudent', async () => {
      await service.studentWorkflow.registerStudent({
        ...record,
        birthDate: record.birthDate ? new Date(record.birthDate) : undefined,
      })
    }),
    enrollStudent: record => withSeedPortError('population.enrollStudent', async () => {
      await service.studentWorkflow.enrollStudent(record)
    }),
    registerGuardian: record => withSeedPortError('population.registerGuardian', async () => {
      await service.studentWorkflow.registerGuardian(record)
    }),
    linkGuardianToStudent: record => withSeedPortError('population.linkGuardianToStudent', async () => {
      await service.studentWorkflow.linkGuardianToStudent(record)
    }),
  }
}
