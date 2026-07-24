import type { HttpSeedClient } from '../../../transport/http/client'
import type { CoreHttpRequestOptions } from '../../../transport/http/core-entity'
import type { AttendanceSeedPort } from '../port'
import { withSeedPortError } from '../../../support/seed-port-error'
import { postCoreCommand, postEntityFindById } from '../../../transport/http/core-entity'

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
    recordDailyAttendance: record => withSeedPortError('attendance.recordDailyAttendance', async () => {
      await postCoreCommand(requestOptions, 'recordDailyAttendance', {
        id: record.id,
        studentId: record.studentId,
        classGroupId: record.classGroupId,
        date: `${record.date}T12:00:00.000Z`,
        status: record.status,
      })
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
        const studentId = 'studentId' in existing && typeof existing.studentId === 'string'
          ? existing.studentId
          : undefined
        if (!studentId) {
          return
        }
        await postCoreCommand(requestOptions, 'requestAttendanceJustification', {
          studentId,
          attendanceId: recordId,
          reason,
        })
      }),
  }
}
