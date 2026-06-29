import type { HttpSeedClient } from '../http/client'
import type { CoreHttpRequestOptions } from '../http/core-entity'
import type { AccessSeedPort } from './port'
import { postEntityFindById, postEntitySave } from '../http/core-entity'
import { withSeedPortError } from '../seed-port-error'

export interface CreateHttpAccessSeedPortOptions {
  client: HttpSeedClient
  serviceAccountApiKey?: string
}

export function createHttpAccessSeedPort(options: CreateHttpAccessSeedPortOptions): AccessSeedPort {
  const requestOptions: CoreHttpRequestOptions = {
    client: options.client,
    serviceAccountApiKey: options.serviceAccountApiKey,
    requestId: 'http-access-seed',
  }

  return {
    schoolExists: schoolId => withSeedPortError('access.schoolExists', async () =>
      Boolean(await postEntityFindById(requestOptions, 'schools', schoolId))),
    saveAccessRole: record => withSeedPortError('access.saveAccessRole', async () => {
      await postEntitySave(requestOptions, 'accessRoles', record)
    }),
    saveStaffRoleAssignment: record => withSeedPortError('access.saveStaffRoleAssignment', async () => {
      await postEntitySave(requestOptions, 'staffRoleAssignments', record)
    }),
    saveStaffAssignment: record => withSeedPortError('access.saveStaffAssignment', async () => {
      await postEntitySave(requestOptions, 'staffAssignments', record)
    }),
  }
}
