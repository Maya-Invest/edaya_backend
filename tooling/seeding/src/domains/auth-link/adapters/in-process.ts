import type { SeedApplication } from '../../../support/types'
import type { AuthLinkSeedPort } from '../port'
import { createSystemActorMetadata } from '@edaya/authorization'
import { School } from '@edaya/core'
import { SEED_SCHOOL_ID } from '@edaya/fixtures/shared/ids'
import { SeedPortError, withSeedPortError } from '../../../support/seed-port-error'

export function createInProcessAuthLinkSeedPort(application: SeedApplication): AuthLinkSeedPort {
  const actor = createSystemActorMetadata({
    schoolId: SEED_SCHOOL_ID,
    requestId: 'dev-staff-auth-seed',
    systemId: 'fixture-seed',
    reason: 'Install the selected local development dataset',
  })
  const service = application.forActor(actor)

  return {
    findSchoolById: id => withSeedPortError('findSchoolById', async () => {
      const school = await application.repositories.schools.findById(id)
      return school ? { id: school.id, ownerSubjectId: school.ownerSubjectId } : undefined
    }),
    setSchoolOwnerSubjectId: (schoolId, subjectId) => withSeedPortError('setSchoolOwnerSubjectId', async () => {
      const school = await application.repositories.schools.findById(schoolId)
      if (!school) {
        throw new SeedPortError('setSchoolOwnerSubjectId', { detail: `School not found: ${schoolId}` })
      }
      await application.repositories.schools.save(new School({
        id: school.id,
        name: school.name,
        timeZone: school.timeZone,
        ownerSubjectId: subjectId,
        type: school.type,
        country: school.country,
        city: school.city,
        createdAt: school.createdAt,
      }))
    }),
    findStaffById: id => withSeedPortError('findStaffById', async () => {
      const staff = await application.repositories.staffMembers.findById(id)
      return staff ? { id: staff.id, subjectId: staff.subjectId } : undefined
    }),
    registerStaffMember: input => withSeedPortError('registerStaffMember', async () => {
      await service.setupWorkflow.registerStaffMember(input)
    }),
    replaceStaffSubjectId: (staffId, subjectId) => withSeedPortError('replaceStaffSubjectId', async () => {
      await service.accessControlWorkflow.relinkActorSubject({ staffMemberId: staffId, subjectId })
    }),
    findGuardianById: id => withSeedPortError('findGuardianById', async () => {
      const guardian = await application.repositories.guardians.findById(id)
      return guardian ? { id: guardian.id, subjectId: guardian.subjectId } : undefined
    }),
    findTeacherById: id => withSeedPortError('findTeacherById', async () => {
      const teacher = await application.repositories.teachers.findById(id)
      return teacher ? { id: teacher.id, subjectId: teacher.subjectId } : undefined
    }),
    replaceGuardianSubjectId: (guardianId, subjectId) => withSeedPortError('replaceGuardianSubjectId', async () => {
      await service.accessControlWorkflow.relinkActorSubject({ guardianId, subjectId })
    }),
    linkActorSubject: input => withSeedPortError('linkActorSubject', async () => {
      await service.accessControlWorkflow.linkActorSubject(input)
    }),
  }
}
