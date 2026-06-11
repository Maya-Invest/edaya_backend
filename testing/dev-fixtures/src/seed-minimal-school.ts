import type { SchoolApplication } from '@edaya/core'
import {
  createSystemActorMetadata,
  Guardian,
} from '@edaya/core'
import {
  DEV_AUTH_GUARDIAN_ACCOUNTS,
  DEV_AUTH_STAFF_ACCOUNTS,
  SEED_GUARDIANS,
  SEED_SCHOOL_ID,
  SEED_SCHOOL_PROFILE,
  SEED_STAFF,
  splitDisplayName,
} from './dataset'

function findSeedStaff(staffId: string) {
  const staff = SEED_STAFF.find(entry => entry.id === staffId)
  if (!staff) {
    throw new Error(`Seed staff fixture ${staffId} not found`)
  }
  return staff
}

function findSeedGuardian(guardianId: string) {
  const guardian = SEED_GUARDIANS.find(entry => entry.id === guardianId)
  if (!guardian) {
    throw new Error(`Seed guardian fixture ${guardianId} not found`)
  }
  return guardian
}

/** Seeds the minimal school + staff + guardian fixtures used by Better Auth integration tests. */
export async function seedMinimalSchoolFixtures(application: SchoolApplication): Promise<void> {
  const existingSchools = await application.repositories.schools.list()
  if (existingSchools.length > 0) {
    return
  }

  const actor = createSystemActorMetadata({
    systemId: 'auth-integration-seed',
    schoolId: SEED_SCHOOL_ID,
    requestId: 'auth-integration-seed',
    reason: 'Seed minimal school fixtures for Better Auth integration tests',
  })
  const service = application.forActor(actor)

  await service.registerSchool(SEED_SCHOOL_PROFILE)

  const staffFixture = findSeedStaff(DEV_AUTH_STAFF_ACCOUNTS[0].staffId)
  const { firstName: staffFirstName, lastName: staffLastName } = splitDisplayName(staffFixture.name)
  await service.registerStaffMember({
    id: staffFixture.id,
    schoolId: SEED_SCHOOL_ID,
    firstName: staffFirstName,
    lastName: staffLastName,
    email: staffFixture.email,
  })

  const guardianFixture = findSeedGuardian(DEV_AUTH_GUARDIAN_ACCOUNTS[0].guardianId)
  const { firstName: guardianFirstName, lastName: guardianLastName } = splitDisplayName(guardianFixture.name)
  await application.repositories.guardians.save(new Guardian({
    id: guardianFixture.id,
    schoolId: SEED_SCHOOL_ID,
    firstName: guardianFirstName,
    lastName: guardianLastName,
    email: guardianFixture.email,
    phone: guardianFixture.phone,
  }))
}
