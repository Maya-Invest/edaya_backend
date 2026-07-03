import type { SeedApplication } from '../../support/types'
import type { AccessSeedPort } from './port'
import { StaffAssignment, StaffPermissionAssignment } from '@edaya/core'
import { withSeedPortError } from '../../support/seed-port-error'

export function createInProcessAccessSeedPort(application: SeedApplication): AccessSeedPort {
  return {
    schoolExists: schoolId => withSeedPortError('access.schoolExists', async () =>
      Boolean(await application.repositories.schools.findById(schoolId))),
    saveStaffPermissionAssignment: record => withSeedPortError('access.saveStaffPermissionAssignment', async () => {
      await application.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment(record))
    }),
    saveStaffAssignment: record => withSeedPortError('access.saveStaffAssignment', async () => {
      await application.repositories.staffAssignments.save(new StaffAssignment({
        ...record,
        permissions: record.permissions ? [...record.permissions] : undefined,
      }))
    }),
  }
}
