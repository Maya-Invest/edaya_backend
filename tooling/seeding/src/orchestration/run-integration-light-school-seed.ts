import type { AuthLinkSeedPort } from '../domains/auth-link/port'
import type { AuthProvisioner, SeedApplication } from '../support/types'
import {
  DEV_AUTH_PASSWORD,
  DEV_AUTH_STAFF_ACCOUNTS,
  INTEGRATION_LIGHT_GUARDIANS,
  INTEGRATION_LIGHT_STUDENTS,
  SEED_ACADEMIC_PERIODS,
  SEED_ACADEMIC_YEAR_ID,
  SEED_CLASSES,
  SEED_GRADE_LEVELS,
  SEED_PERIOD_DEFINITIONS,
  SEED_SCHOOL_ID,
  SEED_SCHOOL_OWNER_STAFF_ID,
  SEED_STAFF,
} from '@edaya/dev-fixtures'
import { createInProcessPopulationSeedPort } from '../domains/population/in-process'
import { seedIntegrationLightPopulation } from '../domains/population/workflow'
import { createInProcessSchoolStructureSeedPort } from '../domains/school-structure/in-process'
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
  const structureInspection = await inspectDevSchoolStructure(schoolStructurePort)

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
      account => account.staffId === SEED_SCHOOL_OWNER_STAFF_ID,
    )
    if (ownerAccount) {
      ownerSubjectId = await options.auth.lookupSubjectIdByEmail(ownerAccount.email, DEV_AUTH_PASSWORD)
    }
  }

  await seedDevSchoolStructure(schoolStructurePort, {
    demoSchoolExists: structureInspection.demoSchoolExists,
    ownerSubjectId,
  })
  await seedIntegrationLightPopulation(populationPort)

  return {
    status: 'seeded',
    schoolId: SEED_SCHOOL_ID,
    academicYearId: SEED_ACADEMIC_YEAR_ID,
    gradeLevels: SEED_GRADE_LEVELS.length,
    classes: SEED_CLASSES.length,
    staff: SEED_STAFF.length,
    students: INTEGRATION_LIGHT_STUDENTS.length,
    guardians: INTEGRATION_LIGHT_GUARDIANS.length,
    academicPeriods: SEED_ACADEMIC_PERIODS.length,
    periodDefinitions: SEED_PERIOD_DEFINITIONS.length,
  }
}
