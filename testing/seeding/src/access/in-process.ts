import type { SeedApplication } from '../types'
import type { AccessSeedPort } from './port'
import { AccessRole, StaffAssignment, StaffRoleAssignment } from '@edaya/core'
import { withSeedPortError } from '../seed-port-error'

export function createInProcessAccessSeedPort(application: SeedApplication): AccessSeedPort {
  return {
    schoolExists: schoolId => withSeedPortError('access.schoolExists', async () =>
      Boolean(await application.repositories.schools.findById(schoolId))),
    saveAccessRole: record => withSeedPortError('access.saveAccessRole', async () => {
      await application.repositories.accessRoles.save(new AccessRole({
        ...record,
        permissions: [...record.permissions],
      }))
    }),
    saveStaffRoleAssignment: record => withSeedPortError('access.saveStaffRoleAssignment', async () => {
      await application.repositories.staffRoleAssignments.save(new StaffRoleAssignment({
        ...record,
        roleIds: [...record.roleIds],
        scopeGrants: record.scopeGrants.map(grant => ({
          ...grant,
          scopeEntityIds: [...grant.scopeEntityIds],
        })),
      }))
    }),
    saveStaffAssignment: record => withSeedPortError('access.saveStaffAssignment', async () => {
      await application.repositories.staffAssignments.save(new StaffAssignment(record))
    }),
  }
}
