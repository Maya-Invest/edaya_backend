import type { SeedApplication } from '../support/types'
import { createBootstrapStaffActorMetadata } from '@edaya/authorization'
import { Guardian } from '@edaya/core'
import { minimalDataset } from '@edaya/fixtures'
import { DEV_AUTH_GUARDIAN_ACCOUNTS, DEV_AUTH_STAFF_ACCOUNTS } from '@edaya/fixtures/meta/dev-auth-fixtures'

/** Seeds the minimal school + staff + guardian fixtures used by Better Auth integration tests. */
export async function seedMinimalSchool(application: SeedApplication): Promise<void> {
  const { school, staffMembers, guardians } = minimalDataset.entities
  const staffMember = staffMembers?.[0]
  const guardian = guardians?.[0]

  if (!school || !staffMember || !guardian) {
    throw new Error('Minimal fixture dataset is missing required school, staff, or guardian records')
  }

  const existingSchools = await application.repositories.schools.list()
  if (existingSchools.length > 0) {
    return
  }

  const actor = createBootstrapStaffActorMetadata({
    schoolId: school.id,
    requestId: 'auth-integration-seed',
    staffMemberId: 'auth-integration-seed',
  })
  const service = application.forActor(actor)

  await service.setupWorkflow.registerSchool(school)

  const staffFixture = DEV_AUTH_STAFF_ACCOUNTS.find(account => account.staffId === staffMember.id)
  await service.setupWorkflow.registerStaffMember({
    id: staffMember.id,
    schoolId: school.id,
    firstName: staffMember.firstName,
    lastName: staffMember.lastName,
    email: staffFixture?.email ?? staffMember.email,
    profileRole: staffMember.profileRole ?? undefined,
    sendAccountInvitation: false,
  })

  const guardianFixture = DEV_AUTH_GUARDIAN_ACCOUNTS.find(account => account.guardianId === guardian.id)
  await application.repositories.guardians.save(new Guardian({
    id: guardian.id,
    schoolId: school.id,
    firstName: guardian.firstName,
    lastName: guardian.lastName,
    email: guardianFixture?.email ?? guardian.email,
    phone: guardian.phone,
  }))
}
