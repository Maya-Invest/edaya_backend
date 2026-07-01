import type { SeedApplication } from '../../support/types'
import type { AuthLinkSeedPort } from './port'
import { createBootstrapStaffActorMetadata, Guardian, School, StaffMember } from '@edaya/core'
import { SEED_SCHOOL_ID } from '@edaya/dev-fixtures'
import { SeedPortError, withSeedPortError } from '../../support/seed-port-error'

export function createInProcessAuthLinkSeedPort(application: SeedApplication): AuthLinkSeedPort {
  const actor = createBootstrapStaffActorMetadata({
    schoolId: SEED_SCHOOL_ID,
    requestId: 'dev-staff-auth-seed',
    staffMemberId: 'dev-staff-auth-seed',
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
      const staff = await application.repositories.staffMembers.findById(staffId)
      if (!staff) {
        throw new SeedPortError('replaceStaffSubjectId', { detail: `Staff member not found: ${staffId}` })
      }
      await application.repositories.staffMembers.save(new StaffMember({
        id: staff.id,
        schoolId: staff.schoolId,
        firstName: staff.firstName,
        lastName: staff.lastName,
        email: staff.email,
        subjectId,
        accountKind: staff.accountKind,
        serviceId: staff.serviceId,
        createdBySubjectId: staff.createdBySubjectId,
        serviceElevated: staff.serviceElevated,
        isActive: staff.isActive,
        createdAt: staff.createdAt,
      }))
    }),
    findGuardianById: id => withSeedPortError('findGuardianById', async () => {
      const guardian = await application.repositories.guardians.findById(id)
      return guardian ? { id: guardian.id, subjectId: guardian.subjectId } : undefined
    }),
    replaceGuardianSubjectId: (guardianId, subjectId) => withSeedPortError('replaceGuardianSubjectId', async () => {
      const guardian = await application.repositories.guardians.findById(guardianId)
      if (!guardian) {
        throw new SeedPortError('replaceGuardianSubjectId', { detail: `Guardian not found: ${guardianId}` })
      }
      await application.repositories.guardians.save(new Guardian({
        id: guardian.id,
        schoolId: guardian.schoolId,
        firstName: guardian.firstName,
        lastName: guardian.lastName,
        email: guardian.email,
        phone: guardian.phone,
        subjectId,
        contactMethods: [...guardian.contactMethods],
        hasAccess: guardian.hasAccess,
        createdAt: guardian.createdAt,
      }))
    }),
    linkActorSubject: input => withSeedPortError('linkActorSubject', async () => {
      await service.accessControlWorkflow.linkActorSubject(input)
    }),
  }
}
