import type { HttpSeedClient } from '../../../transport/http/client'
import type { CoreHttpRequestOptions } from '../../../transport/http/core-entity'
import type { SchedulingSeedPort } from '../port'
import { withSeedPortError } from '../../../support/seed-port-error'
import { postCoreCommand } from '../../../transport/http/core-entity'

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
      await postCoreCommand(requestOptions, 'configureResource', record)
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
    assignResourceToClass: record => withSeedPortError('scheduling.assignResourceToClass', async () => {
      await postCoreCommand(requestOptions, 'assignResourceToClass', record)
    }),
    assignResourceToLessonSession: record => withSeedPortError('scheduling.assignResourceToLessonSession', async () => {
      await postCoreCommand(requestOptions, 'assignResourceToLessonSession', record)
    }),
    recordLessonSessionProgress: record => withSeedPortError('scheduling.recordLessonSessionProgress', async () => {
      await postCoreCommand(requestOptions, 'recordLessonSessionProgress', record)
    }),
  }
}
