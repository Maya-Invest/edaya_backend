import type { HttpSeedClient } from '../http/client'
import type { CoreHttpRequestOptions } from '../http/core-entity'
import type { AttendanceSeedPort } from './port'
import { AttendanceJustificationStatus } from '@edaya/core'
import { postCoreCommand, postEntityFindById, postEntitySave } from '../http/core-entity'
import { withSeedPortError } from '../seed-port-error'

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
    createSession: record => withSeedPortError('attendance.createSession', async () => {
      await postCoreCommand(requestOptions, 'createSession', record)
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
