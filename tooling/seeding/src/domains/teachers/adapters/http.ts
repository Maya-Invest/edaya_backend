import type { HttpSeedClient } from '../../../transport/http/client'
import type { CoreHttpRequestOptions } from '../../../transport/http/core-entity'
import type { TeachersSeedPort } from '../port'
import { withSeedPortError } from '../../../support/seed-port-error'
import { postCoreCommand, postEntitySave } from '../../../transport/http/core-entity'

export interface CreateHttpTeachersSeedPortOptions {
  client: HttpSeedClient
  serviceAccountApiKey?: string
}

export function createHttpTeachersSeedPort(
  options: CreateHttpTeachersSeedPortOptions,
): TeachersSeedPort {
  const requestOptions: CoreHttpRequestOptions = {
    client: options.client,
    serviceAccountApiKey: options.serviceAccountApiKey,
    requestId: 'http-teachers-seed',
  }

  return {
    saveTeacher: record => withSeedPortError('teachers.saveTeacher', async () => {
      await postCoreCommand(requestOptions, 'registerTeacher', {
        ...record,
        isActive: true,
      })
    }),
    saveTeacherAssignment: record => withSeedPortError('teachers.saveTeacherAssignment', async () => {
      await postEntitySave(requestOptions, 'teacherAssignments', record)
    }),
  }
}
