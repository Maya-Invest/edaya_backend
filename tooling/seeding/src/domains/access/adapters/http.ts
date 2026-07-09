import type { HttpSeedClient } from '../../../transport/http/client'
import type { CoreHttpRequestOptions } from '../../../transport/http/core-entity'
import type { AccessSeedPort, StaffAssignmentSeedRecord } from '../port'
import { SeedPortError, withSeedPortError } from '../../../support/seed-port-error'
import { postCoreCommand, postEntityFindById } from '../../../transport/http/core-entity'

export interface CreateHttpAccessSeedPortOptions {
  client: HttpSeedClient
  serviceAccountApiKey?: string
}

function staffAssignmentCommand(record: StaffAssignmentSeedRecord): {
  command: 'assignStaffToClass' | 'assignStaffToClassSubject' | 'assignStaffToLessonSession'
  payload: StaffAssignmentSeedRecord
} {
  if (record.classGroupId) {
    return { command: 'assignStaffToClass', payload: record }
  }
  if (record.classSubjectId) {
    return { command: 'assignStaffToClassSubject', payload: record }
  }
  if (record.lessonSessionId) {
    return { command: 'assignStaffToLessonSession', payload: record }
  }
  throw new SeedPortError('access.saveStaffAssignment', {
    detail: 'Staff assignment must target classGroupId, classSubjectId, or lessonSessionId',
  })
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
    saveStaffPermissionAssignment: record => withSeedPortError('access.saveStaffPermissionAssignment', async () => {
      await postCoreCommand(requestOptions, 'assignStaffPermission', record)
    }),
    saveStaffAssignment: record => withSeedPortError('access.saveStaffAssignment', async () => {
      const { command, payload } = staffAssignmentCommand(record)
      await postCoreCommand(requestOptions, command, payload)
    }),
  }
}
