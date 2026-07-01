import type { HttpSeedClient } from '../../http/client'
import type { CoreHttpRequestOptions } from '../../http/core-entity'
import type { SchedulingSeedPort } from './port'
import { postCoreCommand, postEntitySave } from '../../http/core-entity'
import { withSeedPortError } from '../../support/seed-port-error'

export interface CreateHttpSchedulingSeedPortOptions {
  client: HttpSeedClient
  serviceAccountApiKey?: string
}

export function createHttpSchedulingSeedPort(
  options: CreateHttpSchedulingSeedPortOptions,
): SchedulingSeedPort {
  const requestOptions: CoreHttpRequestOptions = {
    client: options.client,
    serviceAccountApiKey: options.serviceAccountApiKey,
    requestId: 'http-scheduling-seed',
  }

  return {
    saveResource: record => withSeedPortError('scheduling.saveResource', async () => {
      await postEntitySave(requestOptions, 'resources', record)
    }),
    createSchedule: record => withSeedPortError('scheduling.createSchedule', async () => {
      await postCoreCommand(requestOptions, 'createSchedule', record)
    }),
    materializeSchedule: input => withSeedPortError('scheduling.materializeSchedule', async () => {
      await postCoreCommand(requestOptions, 'materializeSchedule', input)
    }),
    assignStaffToLessonSession: record => withSeedPortError('scheduling.assignStaffToLessonSession', async () => {
      await postCoreCommand(requestOptions, 'assignStaffToLessonSession', record)
    }),
    assignResourceToLessonSession: record => withSeedPortError('scheduling.assignResourceToLessonSession', async () => {
      await postCoreCommand(requestOptions, 'assignResourceToLessonSession', record)
    }),
    recordLessonSessionProgress: record => withSeedPortError('scheduling.recordLessonSessionProgress', async () => {
      await postCoreCommand(requestOptions, 'recordLessonSessionProgress', record)
    }),
  }
}
