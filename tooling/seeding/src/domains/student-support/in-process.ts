import type { SeedApplication } from '../../support/types'
import type { StudentSupportSeedPort } from './port'
import { createInProcessSeedService } from '../../support/in-process-seed-service'
import { withSeedPortError } from '../../support/seed-port-error'

export function createInProcessStudentSupportSeedPort(
  application: SeedApplication,
): StudentSupportSeedPort {
  const service = createInProcessSeedService(application, 'dev-student-support-seed')

  return {
    upsertStudentHealthProfile: record =>
      withSeedPortError('studentSupport.upsertStudentHealthProfile', async () => {
        await service.studentWorkflow.upsertStudentHealthProfile({
          ...record,
          lastVisit: record.lastVisit ? new Date(record.lastVisit) : undefined,
        })
      }),
    createStudentNote: record => withSeedPortError('studentSupport.createStudentNote', async () => {
      await service.studentWorkflow.createStudentNote({
        ...record,
        createdAt: new Date(record.createdAt),
      })
    }),
  }
}
