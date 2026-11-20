import type { HttpSeedClient } from '../../../transport/http/client'
import type { CoreHttpRequestOptions } from '../../../transport/http/core-entity'
import type { AccessSeedPort, StaffAssignmentSeedRecord } from '../port'
import { Permission } from '@edaya/core'
import { ApiError } from '@maya-invest/edaya-api-client'
import { SeedPortError, withSeedPortError } from '../../../support/seed-port-error'
import { postCoreCommand, postEntityFindById, postEntityList } from '../../../transport/http/core-entity'
import { createSeedSchoolClient } from '../../../transport/http/school-client'

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

function asRecordList(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
  }
  return []
}

function recordString(row: Record<string, unknown>, key: string): string | undefined {
  const value = row[key]
  return typeof value === 'string' ? value : undefined
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
      try {
        await createSeedSchoolClient(options.client, requestOptions).commands.assignStaffPermission({ ...record, customScopes: record.scopes.filter(scope => scope.kind !== 'school'), useDefaultScopes: false })
      }
      catch (error) {
        // The command has already authorized and resolved these exact scopes.
        // A repeat seed need not add a manual grant over the existing profile.
        if (!(error instanceof ApiError) || error.status !== 409 || !error.body || typeof error.body !== 'object' || !('code' in error.body) || error.body.code !== 'PROFILE_GRANT_DUPLICATE')
          throw error
      }
    }),
    saveStaffAssignment: record => withSeedPortError('access.saveStaffAssignment', async () => {
      const { command, payload } = staffAssignmentCommand(record)
      await postCoreCommand(requestOptions, command, payload)
    }),
    listPermissionProfiles: schoolId => withSeedPortError('access.listPermissionProfiles', async () => {
      const rows = asRecordList(await postEntityList(requestOptions, 'staffPermissionProfiles', { schoolId }))
      return rows.flatMap((row) => {
        const id = recordString(row, 'id')
        const selected = row as { permissions?: unknown }
        const permissions = Array.isArray(selected.permissions) ? selected.permissions.filter((value): value is Permission => Object.values(Permission).includes(value as Permission)) : []
        if (!id) {
          return []
        }
        return [{
          id,
          sourceKey: recordString(row, 'sourceKey'),
          permissions,
        }]
      })
    }),
    applyStaffPermissionProfile: record => withSeedPortError('access.applyStaffPermissionProfile', async () => {
      await postCoreCommand(requestOptions, 'applyStaffPermissionProfile', record)
    }),
  }
}
