import type { HttpSeedRuntimeContext } from '../types'
import { AcademicYear } from '@edaya/core'
import { SEED_SCHOOL_PROFILES } from '@edaya/fixtures/meta/school-profiles'
import { signInSeedAccount } from '../../bootstrap/auth/http-provisioner'
import { postCoreCommand, postEntityFindById } from '../../transport/http/core-entity'

/** A second, intentionally small campus for the same owner. Never adopt an existing school. */
export async function seedSchoolSwitching({ client, seedContext }: Pick<HttpSeedRuntimeContext, 'client' | 'seedContext'>): Promise<string> {
  const school = SEED_SCHOOL_PROFILES.find(profile => profile.id === 'sch-edaya-central')!
  const owner = seedContext.staffAccounts.find(account => account.staffId === seedContext.ownerStaffId)
  const member = seedContext.dataset.entities.staffMembers?.find(staff => staff.id === owner?.staffId)
  if (!owner || !member || !seedContext.dataset.entities.academicYear)
    throw new Error('The switching fixture requires the primary demo owner and academic year')
  const year = new AcademicYear(seedContext.dataset.entities.academicYear)
  const actorId = 'staff-edaya-central-owner'
  const opts = { client, actor: { schoolId: school.id, actorId } }

  await client.withCookieSnapshot(async () => {
    const { subjectId } = await signInSeedAccount(client, owner.email)
    const primary = await postEntityFindById({ client, actor: { schoolId: seedContext.schoolId, actorId: owner.staffId } }, 'schools', seedContext.schoolId) as { ownerSubjectId?: string } | undefined
    if (primary?.ownerSubjectId !== subjectId)
      throw new Error('Seed the primary school and its owner before seeding school switching')

    const memberships = await client.jsonRequest<{ profiles: { schoolId: string, actorId: string, kind: string }[] }>('/core/authorization/profiles')
    if (!memberships.response.ok || !memberships.body?.profiles)
      throw new Error('Could not read the demo owner’s school memberships')
    if (!memberships.body.profiles.some(profile => profile.kind === 'staff' && profile.schoolId === school.id && profile.actorId === actorId)) {
      const { response } = await client.jsonRequest('/core/onboarding/register-school', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-school-id': seedContext.schoolId, 'x-actor-kind': 'staff', 'x-actor-id': owner.staffId },
        body: JSON.stringify({
          ownerIdentifier: member.identifier,
          id: school.id,
          name: school.name,
          shortName: school.shortName,
          timeZone: school.timeZone,
          city: school.city,
          country: 'FR',
          financeCurrency: 'EUR',
          ownerStaffId: actorId,
          ownerFirstName: member.firstName,
          ownerLastName: member.lastName,
          ownerEmail: owner.email,
        }),
      })
      if (!response.ok)
        throw new Error(`Could not register the second demo school: HTTP ${response.status}`)
    }
    const campus = await postEntityFindById(opts, 'schools', school.id) as { ownerSubjectId?: string } | undefined
    if (campus?.ownerSubjectId !== subjectId)
      throw new Error('The second demo school does not belong to the primary owner')

    const yearId = `${school.id}-${year.id}`
    const existingYear = await postEntityFindById(opts, 'academicYears', yearId) as { status: string } | undefined
    if (!existingYear)
      await postCoreCommand(opts, 'createAcademicYear', { id: yearId, schoolId: school.id, name: year.name, shortName: year.shortName, startDate: year.startDate, endDate: year.endDate })
    if (!existingYear || existingYear.status === 'draft')
      await postCoreCommand(opts, 'publishAcademicYear', { academicYearId: yearId })

    const gradeId = `${school.id}-6e`
    if (!await postEntityFindById(opts, 'gradeLevels', gradeId))
      await postCoreCommand(opts, 'configureGradeLevel', { id: gradeId, schoolId: school.id, name: 'Sixième', shortName: '6e', cycle: 'Collège', order: 1 })
  })
  return school.name
}
