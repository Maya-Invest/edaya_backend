import type { SeedApplication } from '../types'
import type { AttendanceSeedPort } from './port'
import { AttendanceJustificationStatus } from '@edaya/core'
import { createInProcessSeedService } from '../in-process-seed-service'
import { withSeedPortError } from '../seed-port-error'

export function createInProcessAttendanceSeedPort(
  application: SeedApplication,
): AttendanceSeedPort {
  const service = createInProcessSeedService(application, 'dev-attendance-seed')

  return {
    createSession: record => withSeedPortError('attendance.createSession', async () => {
      await service.schedulingWorkflow.createSession({
        ...record,
        startsAt: new Date(record.startsAt),
        endsAt: new Date(record.endsAt),
      })
    }),
    recordAttendance: record => withSeedPortError('attendance.recordAttendance', async () => {
      await service.schedulingWorkflow.recordAttendance(record)
    }),
    markJustificationPending: (recordId, fallbackReason) =>
      withSeedPortError('attendance.markJustificationPending', async () => {
        const existing = await application.repositories.attendance.findById(recordId)
        if (!existing) {
          return
        }
        await service.baseService.entities.attendance.save(existing.copyWith({
          justificationStatus: AttendanceJustificationStatus.Pending,
          reason: existing.reason ?? fallbackReason,
        }), { moduleChecked: true })
      }),
  }
}
