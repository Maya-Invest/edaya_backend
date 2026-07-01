import type { HttpSeedClient } from '../../http/client'
import type { CoreHttpRequestOptions } from '../../http/core-entity'
import type { SchoolStructureSeedPort } from './port'
import { postCoreCommand, postEntityFindById, postEntityList, postEntitySave } from '../../http/core-entity'
import { withSeedPortError } from '../../support/seed-port-error'

export interface CreateHttpSchoolStructureSeedPortOptions {
  client: HttpSeedClient
  serviceAccountApiKey?: string
}

function entityId(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || !('id' in value)) {
    return undefined
  }
  return typeof value.id === 'string' ? value.id : undefined
}

export function createHttpSchoolStructureSeedPort(
  options: CreateHttpSchoolStructureSeedPortOptions,
): SchoolStructureSeedPort {
  const requestOptions: CoreHttpRequestOptions = {
    client: options.client,
    serviceAccountApiKey: options.serviceAccountApiKey,
    requestId: 'http-school-structure-seed',
  }

  return {
    inspectSeedState: demoSchoolId => withSeedPortError('schoolStructure.inspectSeedState', async () => {
      const schools = await postEntityList(requestOptions, 'schools')
      const schoolIds = schools.map(entityId).filter((id): id is string => Boolean(id))
      const studentCount = schoolIds.includes(demoSchoolId)
        ? (await postEntityList(requestOptions, 'students')).length
        : 0
      return { schoolIds, studentCount }
    }),
    registerSchool: record => withSeedPortError('schoolStructure.registerSchool', async () => {
      await postCoreCommand(requestOptions, 'registerSchool', record)
    }),
    saveGradeLevel: record => withSeedPortError('schoolStructure.saveGradeLevel', async () => {
      await postEntitySave(requestOptions, 'gradeLevels', record)
    }),
    createAcademicYear: record => withSeedPortError('schoolStructure.createAcademicYear', async () => {
      await postCoreCommand(requestOptions, 'createAcademicYear', record)
    }),
    createAcademicPeriod: record => withSeedPortError('schoolStructure.createAcademicPeriod', async () => {
      await postCoreCommand(requestOptions, 'createAcademicPeriod', record)
    }),
    publishAcademicPeriod: academicPeriodId => withSeedPortError('schoolStructure.publishAcademicPeriod', async () => {
      await postCoreCommand(requestOptions, 'publishAcademicPeriod', { academicPeriodId })
    }),
    savePeriodDefinition: record => withSeedPortError('schoolStructure.savePeriodDefinition', async () => {
      await postEntitySave(requestOptions, 'periodDefinitions', record)
    }),
    staffMemberExists: staffId => withSeedPortError('schoolStructure.staffMemberExists', async () =>
      Boolean(await postEntityFindById(requestOptions, 'staffMembers', staffId))),
    registerStaffMember: record => withSeedPortError('schoolStructure.registerStaffMember', async () => {
      await postCoreCommand(requestOptions, 'registerStaffMember', record)
    }),
    createClassGroup: record => withSeedPortError('schoolStructure.createClassGroup', async () => {
      await postCoreCommand(requestOptions, 'createClassGroup', record)
    }),
  }
}
