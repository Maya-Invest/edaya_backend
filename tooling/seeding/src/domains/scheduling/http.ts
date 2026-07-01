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
    createSession: record => withSeedPortError('scheduling.createSession', async () => {
      await postCoreCommand(requestOptions, 'createSession', record)
    }),
    assignStaffToSession: record => withSeedPortError('scheduling.assignStaffToSession', async () => {
      await postCoreCommand(requestOptions, 'assignStaffToSession', record)
    }),
    assignResourceToSession: record => withSeedPortError('scheduling.assignResourceToSession', async () => {
      await postCoreCommand(requestOptions, 'assignResourceToSession', record)
    }),
    recordSessionProgress: record => withSeedPortError('scheduling.recordSessionProgress', async () => {
      await postCoreCommand(requestOptions, 'recordSessionProgress', record)
    }),
  }
}
