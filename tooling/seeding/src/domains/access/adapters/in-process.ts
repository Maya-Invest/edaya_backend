import type { SeedApplication } from '../../../support/types'
import type { AccessSeedPort } from '../port'
import { StaffAssignment } from '@edaya/core'
import { createInProcessSeedService } from '../../../support/in-process-seed-service'
import { withSeedPortError } from '../../../support/seed-port-error'

export function createInProcessAccessSeedPort(application: SeedApplication): AccessSeedPort {
  const service = createInProcessSeedService(application, 'seed-access')
  return {
    schoolExists: schoolId => withSeedPortError('access.schoolExists', async () =>
      Boolean(await application.repositories.schools.findById(schoolId))),
    saveStaffPermissionAssignment: record => withSeedPortError('access.saveStaffPermissionAssignment', async () => {
      await service.accessControlWorkflow.assignStaffPermission({ ...record, customScopes: record.scopes.filter(scope => scope.kind !== 'school'), useDefaultScopes: false })
    }),
    saveStaffAssignment: record => withSeedPortError('access.saveStaffAssignment', async () => {
      await service.baseService.entities.staffAssignments.save(new StaffAssignment({
        ...record,
        permissions: record.permissions ? [...record.permissions] : undefined,
      }))
    }),
    listPermissionProfiles: schoolId => withSeedPortError('access.listPermissionProfiles', async () => {
      const rows = await application.repositories.staffPermissionProfiles.list({ schoolId })
      return rows.map(row => ({
        id: row.id,
        sourceKey: row.sourceKey,
        permissions: row.permissions,
      }))
    }),
    applyStaffPermissionProfile: record => withSeedPortError('access.applyStaffPermissionProfile', async () => {
      await service.accessControlWorkflow.applyStaffPermissionProfile(record)
    }),
  }
}
