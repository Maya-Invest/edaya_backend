import type { SeedApplication } from '../../../support/types'
import type { AccessSeedPort } from '../port'
import { StaffAssignment, StaffPermissionAssignment } from '@edaya/core'
import { createInProcessSeedService } from '../../../support/in-process-seed-service'
import { withSeedPortError } from '../../../support/seed-port-error'

export function createInProcessAccessSeedPort(application: SeedApplication): AccessSeedPort {
  const service = createInProcessSeedService(application, 'seed-access')
  return {
    schoolExists: schoolId => withSeedPortError('access.schoolExists', async () =>
      Boolean(await application.repositories.schools.findById(schoolId))),
    saveStaffPermissionAssignment: record => withSeedPortError('access.saveStaffPermissionAssignment', async () => {
      await service.baseService.entities.staffPermissionAssignments.save(new StaffPermissionAssignment(record))
    }),
    saveStaffAssignment: record => withSeedPortError('access.saveStaffAssignment', async () => {
      await service.baseService.entities.staffAssignments.save(new StaffAssignment({
        ...record,
        permissions: record.permissions ? [...record.permissions] : undefined,
      }))
    }),
  }
}
