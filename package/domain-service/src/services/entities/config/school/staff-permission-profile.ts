import type { StaffPermissionProfile } from '@edaya/core'
import type { EntityConfigFactory } from '../../entity-config'
import { finishPermissionProfileCatalogDelete, preparePermissionProfileCatalogDelete } from '../../../../capabilities/access-control/delete-permission-profile'
import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

export const staffPermissionProfileConfig: EntityConfigFactory<StaffPermissionProfile> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.staffPermissionProfiles,
    tenant: directSchoolTenant(),
    resource: 'staffPermissionProfiles',
    gates: {
      preDelete: (profile, repos) => preparePermissionProfileCatalogDelete(profile, repos),
    },
    hooks: {
      postDelete: (profile, repos) => finishPermissionProfileCatalogDelete(profile, repos),
    },
    atomicExecution,
  })
