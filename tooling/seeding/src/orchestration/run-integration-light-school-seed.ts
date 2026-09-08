import type { AuthLinkSeedPort } from '../domains/auth-link/port'
import type { AuthProvisioner, SeedApplication } from '../support/types'
import { demoDataset, demoSchoolOwnerStaffId, integrationDataset } from '@edaya/fixtures'
import {
  INTEGRATION_LIGHT_GUARDIANS,
  INTEGRATION_LIGHT_STUDENTS,
} from '@edaya/fixtures/integration/narrative'
import {
  DEV_AUTH_PASSWORD,
  DEV_AUTH_STAFF_ACCOUNTS,
} from '@edaya/fixtures/meta/dev-auth-fixtures'
import { createInProcessPopulationSeedPort } from '../domains/population/adapters/in-process'
import { seedIntegrationLightPopulation } from '../domains/population/workflow'
import { createInProcessSchoolStructureSeedPort } from '../domains/school-structure/adapters/in-process'
import { inspectDevSchoolStructure, seedDevSchoolStructure } from '../domains/school-structure/workflow'

export type IntegrationLightSchoolSeedResult
  = | { status: 'skipped', reason: 'already-seeded', schoolCount: number }
    | {
      status: 'seeded'
      schoolId: string
      academicYearId: string
      gradeLevels: number
      classes: number
      staff: number
      students: number
      guardians: number
      academicPeriods: number
      periodDefinitions: number
    }

export interface RunIntegrationLightSchoolSeedOptions {
  auth?: AuthProvisioner
  ownerSubjectId?: string
  authLinkPort?: AuthLinkSeedPort
}

function requireSeedApplication(
  application: SeedApplication | undefined,
  portName: string,
): SeedApplication {
  if (!application) {
    throw new Error(`${portName} must be provided when no in-process seed application is available`)
  }
  return application
}

/** Fast school fixture for route and auth integration tests (no domain demo data). */
export async function runIntegrationLightSchoolSeed(
  application: SeedApplication | undefined,
  options?: RunIntegrationLightSchoolSeedOptions,
): Promise<IntegrationLightSchoolSeedResult> {
  const seedApplication = requireSeedApplication(application, 'application')
  const schoolStructurePort = createInProcessSchoolStructureSeedPort(seedApplication)
  const populationPort = createInProcessPopulationSeedPort(seedApplication)
  const structureInspection = await inspectDevSchoolStructure(schoolStructurePort, demoDataset)

  if (structureInspection.status === 'skipped') {
    return {
      status: 'skipped',
      reason: 'already-seeded',
      schoolCount: structureInspection.schoolCount,
    }
  }

  let ownerSubjectId = options?.ownerSubjectId
  if (!ownerSubjectId && options?.auth) {
    const ownerAccount = DEV_AUTH_STAFF_ACCOUNTS.find(
      account => account.staffId === demoSchoolOwnerStaffId,
    )
    if (ownerAccount) {
      ownerSubjectId = await options.auth.lookupSubjectIdByEmail(ownerAccount.email, DEV_AUTH_PASSWORD)
    }
  }

  await seedDevSchoolStructure(schoolStructurePort, {
    demoSchoolExists: structureInspection.demoSchoolExists,
    ownerSubjectId,
  }, demoDataset)
  await seedIntegrationLightPopulation(populationPort, integrationDataset)

  const entities = demoDataset.entities

  return {
    status: 'seeded',
    schoolId: demoDataset.schoolId,
    academicYearId: entities.academicYear?.id ?? '',
    gradeLevels: entities.gradeLevels?.length ?? 0,
    classes: entities.classGroups?.length ?? 0,
    staff: entities.staffMembers?.length ?? 0,
    students: INTEGRATION_LIGHT_STUDENTS.length,
    guardians: INTEGRATION_LIGHT_GUARDIANS.length,
    academicPeriods: entities.academicPeriods?.length ?? 0,
    periodDefinitions: entities.periodDefinitions?.length ?? 0,
  }
}
