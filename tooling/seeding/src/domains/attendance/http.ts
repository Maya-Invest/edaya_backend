import type { HttpSeedClient } from '../../http/client'
import type { CoreHttpRequestOptions } from '../../http/core-entity'
import type { AttendanceSeedPort } from './port'
import { AttendanceJustificationStatus } from '@edaya/core'
import { postCoreCommand, postEntityFindById, postEntitySave } from '../../http/core-entity'
import { withSeedPortError } from '../../support/seed-port-error'

export interface CreateHttpAttendanceSeedPortOptions {
  client: HttpSeedClient
  serviceAccountApiKey?: string
}

export function createHttpAttendanceSeedPort(
  options: CreateHttpAttendanceSeedPortOptions,
): AttendanceSeedPort {
  const requestOptions: CoreHttpRequestOptions = {
    client: options.client,
    serviceAccountApiKey: options.serviceAccountApiKey,
    requestId: 'http-attendance-seed',
  }

  return {
    ensureLessonSession: input => withSeedPortError('attendance.ensureLessonSession', async () => {
      await postCoreCommand(requestOptions, 'createSchedule', {
        id: input.scheduleId,
        schoolId: input.schoolId,
        classGroupId: input.classGroupId,
        classSubjectId: input.classSubjectId,
        title: input.title,
        isRecurring: false,
        specificDate: `${input.date}T12:00:00.000Z`,
        startTime: input.startTime,
        endTime: input.endTime,
      })
      await postCoreCommand(requestOptions, 'materializeSchedule', { scheduleId: input.scheduleId })
      return { lessonSessionId: `${input.scheduleId}:${input.date}` }
    }),
    recordAttendance: record => withSeedPortError('attendance.recordAttendance', async () => {
      await postCoreCommand(requestOptions, 'recordAttendance', record)
    }),
    markJustificationPending: (recordId, fallbackReason) =>
      withSeedPortError('attendance.markJustificationPending', async () => {
        const existing = await postEntityFindById(requestOptions, 'attendance', recordId)
        if (!existing || typeof existing !== 'object') {
          return
        }
        const reason = 'reason' in existing && typeof existing.reason === 'string'
          ? existing.reason
          : fallbackReason
        await postEntitySave(requestOptions, 'attendance', {
          ...existing,
          justificationStatus: AttendanceJustificationStatus.Pending,
          reason,
        })
      }),
  }
}
