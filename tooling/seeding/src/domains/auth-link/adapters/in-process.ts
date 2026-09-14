import type { SeedApplication } from '../../../support/types'
import type { AuthLinkSeedPort } from '../port'
import { createSystemActorMetadata } from '@edaya/authorization'
import { resolveDevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import { initializeFixtureSchoolOwner } from '@edaya/service'
import { withSeedPortError } from '../../../support/seed-port-error'

export function createInProcessAuthLinkSeedPort(application: SeedApplication): AuthLinkSeedPort {
  const context = resolveDevSeedContext()
  const actor = createSystemActorMetadata({
    schoolId: context.schoolId,
    requestId: 'dev-staff-auth-seed',
    systemId: 'fixture-seed',
    reason: 'Install the selected local development dataset',
  })
  const service = application.forActor(actor)

  return {
    findSchoolById: id => withSeedPortError('findSchoolById', async () => {
      const school = await service.baseService.entities.schools.findById(id)
      return school ? { id: school.id, ownerSubjectId: school.ownerSubjectId } : undefined
    }),
    setSchoolOwnerSubjectId: (schoolId, subjectId) => withSeedPortError('setSchoolOwnerSubjectId', async () => {
      await initializeFixtureSchoolOwner(service.baseService, { schoolId, staffId: context.ownerStaffId, subjectId })
    }),
    findStaffById: id => withSeedPortError('findStaffById', async () => {
      const staff = await service.baseService.entities.staffMembers.findById(id)
      return staff ? { id: staff.id, subjectId: staff.subjectId } : undefined
    }),
    registerStaffMember: input => withSeedPortError('registerStaffMember', async () => {
      await service.setupWorkflow.registerStaffMember(input)
    }),
    replaceStaffSubjectId: (staffId, subjectId) => withSeedPortError('replaceStaffSubjectId', async () => {
      await service.accessControlWorkflow.relinkActorSubject({ staffMemberId: staffId, subjectId })
    }),
    findGuardianById: id => withSeedPortError('findGuardianById', async () => {
      const guardian = await service.baseService.entities.guardians.findById(id)
      return guardian ? { id: guardian.id, subjectId: guardian.subjectId } : undefined
    }),
    findTeacherById: id => withSeedPortError('findTeacherById', async () => {
      const teacher = await service.baseService.entities.teachers.findById(id)
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
