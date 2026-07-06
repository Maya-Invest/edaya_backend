import type { HttpSeedClient } from '../../../transport/http/client'
import type { CoreHttpRequestOptions } from '../../../transport/http/core-entity'
import type { AuthLinkSeedPort } from '../port'
import { SeedPortError, withSeedPortError } from '../../../support/seed-port-error'
import { postCoreCommand, postEntityFindById } from '../../../transport/http/core-entity'

export interface CreateHttpAuthLinkSeedPortOptions {
  client: HttpSeedClient
  serviceAccountApiKey?: string
}

function entityRecord(value: unknown, operation: string): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SeedPortError(operation, { detail: 'Expected an entity object' })
  }
  return value as Record<string, unknown>
}

function requiredString(record: Record<string, unknown>, field: string, operation: string): string {
  const value = record[field]
  if (typeof value !== 'string' || value.length === 0) {
    throw new SeedPortError(operation, { detail: `Expected non-empty ${field}` })
  }
  return value
}

function optionalString(record: Record<string, unknown>, field: string): string | undefined {
  const value = record[field]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export function createHttpAuthLinkSeedPort(options: CreateHttpAuthLinkSeedPortOptions): AuthLinkSeedPort {
  const requestOptions: CoreHttpRequestOptions = {
    client: options.client,
    serviceAccountApiKey: options.serviceAccountApiKey,
    requestId: 'http-auth-link-seed',
  }

  async function findEntity(id: string, serviceName: 'schools' | 'staffMembers' | 'guardians' | 'teachers', operation: string): Promise<Record<string, unknown> | undefined> {
    return entityRecord(await postEntityFindById(requestOptions, serviceName, id), operation)
  }

  return {
    findSchoolById: id => withSeedPortError('findSchoolById', async () => {
      const school = await findEntity(id, 'schools', 'findSchoolById')
      return school
        ? { id: requiredString(school, 'id', 'findSchoolById'), ownerSubjectId: optionalString(school, 'ownerSubjectId') }
        : undefined
    }),
    setSchoolOwnerSubjectId: (schoolId, subjectId) => withSeedPortError('setSchoolOwnerSubjectId', async () => {
      await postCoreCommand(requestOptions, 'updateSchoolConfiguration', { schoolId, ownerSubjectId: subjectId })
    }),
    findStaffById: id => withSeedPortError('findStaffById', async () => {
      const staff = await findEntity(id, 'staffMembers', 'findStaffById')
      return staff
        ? { id: requiredString(staff, 'id', 'findStaffById'), subjectId: optionalString(staff, 'subjectId') }
        : undefined
    }),
    registerStaffMember: input => withSeedPortError('registerStaffMember', async () => {
      await postCoreCommand(requestOptions, 'registerStaffMember', input)
    }),
    replaceStaffSubjectId: (staffId, subjectId) => withSeedPortError('replaceStaffSubjectId', async () => {
      await postCoreCommand(requestOptions, 'relinkActorSubject', { subjectId, staffMemberId: staffId })
    }),
    findGuardianById: id => withSeedPortError('findGuardianById', async () => {
      const guardian = await findEntity(id, 'guardians', 'findGuardianById')
      return guardian
        ? { id: requiredString(guardian, 'id', 'findGuardianById'), subjectId: optionalString(guardian, 'subjectId') }
        : undefined
    }),
    findTeacherById: id => withSeedPortError('findTeacherById', async () => {
      const teacher = await findEntity(id, 'teachers', 'findTeacherById')
      return teacher
        ? { id: requiredString(teacher, 'id', 'findTeacherById'), subjectId: optionalString(teacher, 'subjectId') }
        : undefined
    }),
    replaceGuardianSubjectId: (guardianId, subjectId) => withSeedPortError('replaceGuardianSubjectId', async () => {
      await postCoreCommand(requestOptions, 'relinkActorSubject', { subjectId, guardianId })
    }),
    linkActorSubject: input => withSeedPortError('linkActorSubject', async () => {
      await postCoreCommand(requestOptions, 'linkActorSubject', input)
    }),
  }
}
