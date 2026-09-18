import type { PermissionProfileScopeGrain } from '@edaya/core'
import type { HttpSeedClient } from '../../../transport/http/client'
import type { CoreHttpRequestOptions } from '../../../transport/http/core-entity'
import type { AccessSeedPort, StaffAssignmentSeedRecord } from '../port'
import { SeedPortError, withSeedPortError } from '../../../support/seed-port-error'
import { postCoreCommand, postEntityFindById, postEntityList } from '../../../transport/http/core-entity'

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

const PROFILE_GRAINS = new Set<PermissionProfileScopeGrain>([
  'school',
  'class_group',
  'class_subject',
  'student',
  'grade_level',
  'grade_level_subject',
  'activity',
])

function asProfileGrain(value: string | undefined): PermissionProfileScopeGrain | undefined {
  if (!value || !PROFILE_GRAINS.has(value as PermissionProfileScopeGrain)) {
    return undefined
  }
  return value as PermissionProfileScopeGrain
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
    listPermissionProfiles: schoolId => withSeedPortError('access.listPermissionProfiles', async () => {
      const rows = asRecordList(await postEntityList(requestOptions, 'staffPermissionProfiles', { schoolId }))
      return rows.flatMap((row) => {
        const id = recordString(row, 'id')
        const scopeGrain = asProfileGrain(recordString(row, 'scopeGrain'))
        if (!id || !scopeGrain) {
          return []
        }
        return [{
          id,
          sourceKey: recordString(row, 'sourceKey'),
          scopeGrain,
        }]
      })
    }),
    applyStaffPermissionProfile: record => withSeedPortError('access.applyStaffPermissionProfile', async () => {
      await postCoreCommand(requestOptions, 'applyStaffPermissionProfile', record)
    }),
  }
}
