import type { SeedEntityKey } from '../http/catalog'
import type { HttpSeedClient } from '../http/client'
import type { CoreHttpRequestOptions } from '../http/core-entity'
import type { AuthLinkSeedPort } from './port'
import { postCoreCommand, postEntityFindById, postEntitySave } from '../http/core-entity'
import { SeedPortError, withSeedPortError } from '../seed-port-error'

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

  async function findEntity(serviceName: SeedEntityKey, id: string, operation: string): Promise<Record<string, unknown> | undefined> {
    return entityRecord(await postEntityFindById(requestOptions, serviceName, id), operation)
  }

  return {
    findSchoolById: id => withSeedPortError('findSchoolById', async () => {
      const school = await findEntity('schools', id, 'findSchoolById')
      return school
        ? { id: requiredString(school, 'id', 'findSchoolById'), ownerSubjectId: optionalString(school, 'ownerSubjectId') }
        : undefined
    }),
    setSchoolOwnerSubjectId: (schoolId, subjectId) => withSeedPortError('setSchoolOwnerSubjectId', async () => {
      const school = await findEntity('schools', schoolId, 'setSchoolOwnerSubjectId')
      if (!school) {
        throw new SeedPortError('setSchoolOwnerSubjectId', { detail: `School not found: ${schoolId}` })
      }
      await postEntitySave(requestOptions, 'schools', { ...school, ownerSubjectId: subjectId })
    }),
    findStaffById: id => withSeedPortError('findStaffById', async () => {
      const staff = await findEntity('staffMembers', id, 'findStaffById')
      return staff
        ? { id: requiredString(staff, 'id', 'findStaffById'), subjectId: optionalString(staff, 'subjectId') }
        : undefined
    }),
    registerStaffMember: input => withSeedPortError('registerStaffMember', async () => {
      await postCoreCommand(requestOptions, 'registerStaffMember', input)
    }),
    replaceStaffSubjectId: (staffId, subjectId) => withSeedPortError('replaceStaffSubjectId', async () => {
      const staff = await findEntity('staffMembers', staffId, 'replaceStaffSubjectId')
      if (!staff) {
        throw new SeedPortError('replaceStaffSubjectId', { detail: `Staff member not found: ${staffId}` })
      }
      await postEntitySave(requestOptions, 'staffMembers', { ...staff, subjectId })
    }),
    findGuardianById: id => withSeedPortError('findGuardianById', async () => {
      const guardian = await findEntity('guardians', id, 'findGuardianById')
      return guardian
        ? { id: requiredString(guardian, 'id', 'findGuardianById'), subjectId: optionalString(guardian, 'subjectId') }
        : undefined
    }),
    replaceGuardianSubjectId: (guardianId, subjectId) => withSeedPortError('replaceGuardianSubjectId', async () => {
      const guardian = await findEntity('guardians', guardianId, 'replaceGuardianSubjectId')
      if (!guardian) {
        throw new SeedPortError('replaceGuardianSubjectId', { detail: `Guardian not found: ${guardianId}` })
      }
      await postEntitySave(requestOptions, 'guardians', { ...guardian, subjectId })
    }),
    linkActorSubject: input => withSeedPortError('linkActorSubject', async () => {
      await postCoreCommand(requestOptions, 'linkActorSubject', input)
    }),
  }
}
