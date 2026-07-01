import type { HttpSeedClient } from '../../http/client'
import type { CoreHttpRequestOptions } from '../../http/core-entity'
import type { SchoolLifeSeedPort } from './port'
import { postCoreCommand } from '../../http/core-entity'
import { withSeedPortError } from '../../support/seed-port-error'

export interface CreateHttpSchoolLifeSeedPortOptions {
  client: HttpSeedClient
  serviceAccountApiKey?: string
}

export function createHttpSchoolLifeSeedPort(
  options: CreateHttpSchoolLifeSeedPortOptions,
): SchoolLifeSeedPort {
  const requestOptions: CoreHttpRequestOptions = {
    client: options.client,
    serviceAccountApiKey: options.serviceAccountApiKey,
    requestId: 'http-school-life-seed',
  }

  return {
    createCalendarEvent: record => withSeedPortError('schoolLife.createCalendarEvent', async () => {
      await postCoreCommand(requestOptions, 'createCalendarEvent', record)
    }),
    recordIncident: record => withSeedPortError('schoolLife.recordIncident', async () => {
      await postCoreCommand(requestOptions, 'recordIncident', record)
    }),
    addStudentInvolvement: record =>
      withSeedPortError('schoolLife.addStudentInvolvement', async () => {
        await postCoreCommand(requestOptions, 'addStudentInvolvement', record)
      }),
  }
}
