import type { SeedApplication } from '../../../support/types'
import type { DisciplineSeedPort } from '../port'
import { DisciplinaryAction } from '@edaya/core'
import { createInProcessSeedService } from '../../../support/in-process-seed-service'
import { withSeedPortError } from '../../../support/seed-port-error'

export function createInProcessDisciplineSeedPort(
  application: SeedApplication,
): DisciplineSeedPort {
  const service = createInProcessSeedService(application, 'dev-discipline-seed')

  return {
    saveDisciplinaryAction: record =>
      withSeedPortError('discipline.saveDisciplinaryAction', async () => {
        await service.baseService.entities.disciplinaryActions.save(new DisciplinaryAction(record), {
          moduleChecked: true,
        })
      }),
    applyDisciplinaryAction: record =>
      withSeedPortError('discipline.applyDisciplinaryAction', async () => {
        await service.behaviorWorkflow.applyDisciplinaryAction({
          id: record.id,
          incidentId: record.incidentId,
          studentId: record.studentId,
          disciplinaryActionId: record.disciplinaryActionId,
          startsAt: record.startsAt ? new Date(record.startsAt) : undefined,
          endsAt: record.endsAt ? new Date(record.endsAt) : undefined,
          createdAt: new Date(record.createdAt),
          ...(record.notes ? { notes: record.notes } : {}),
        })
      }),
    updateStudentDisciplinaryActionStatus: record =>
      withSeedPortError('discipline.updateStudentDisciplinaryActionStatus', async () => {
        await service.behaviorWorkflow.updateStudentDisciplinaryActionStatus(record)
      }),
  }
}
