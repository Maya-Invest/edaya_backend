import type { SeedApplication } from '../../../support/types'
import type { AttendanceSeedPort } from '../port'
import { AttendanceJustificationStatus } from '@edaya/core'
import { createInProcessSeedService } from '../../../support/in-process-seed-service'
import { withSeedPortError } from '../../../support/seed-port-error'

export function createInProcessAttendanceSeedPort(
  application: SeedApplication,
): AttendanceSeedPort {
  const service = createInProcessSeedService(application, 'dev-attendance-seed')

  return {
    ensureLessonSession: input => withSeedPortError('attendance.ensureLessonSession', async () => {
      await service.schedulingWorkflow.createSchedule({
        id: input.scheduleId,
        schoolId: input.schoolId,
        classGroupId: input.classGroupId,
        classSubjectId: input.classSubjectId,
        title: input.title,
        isRecurring: false,
        specificDate: new Date(`${input.date}T12:00:00.000Z`),
        startTime: input.startTime,
        endTime: input.endTime,
      })
      await service.schedulingWorkflow.materializeSchedule({ scheduleId: input.scheduleId })
      const lessonSessionId = `${input.scheduleId}:${input.date}`
      const lessonSession = await application.repositories.lessonSessions.findById(lessonSessionId)
      if (!lessonSession) {
        throw new Error(`Failed to materialize lesson session for schedule ${input.scheduleId} on ${input.date}`)
      }
      return { lessonSessionId: lessonSession.id }
    }),
    recordAttendance: record => withSeedPortError('attendance.recordAttendance', async () => {
      await service.schedulingWorkflow.recordAttendance(record)
    }),
    recordClassDailyAttendance: input => withSeedPortError('attendance.recordClassDailyAttendance', async () => {
      await service.schedulingWorkflow.recordClassDailyAttendance(input)
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
