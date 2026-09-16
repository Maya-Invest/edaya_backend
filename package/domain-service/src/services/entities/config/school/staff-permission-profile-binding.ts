import type { StaffPermissionProfileBinding } from '@edaya/core'
import type { EntityConfigFactory } from '../../entity-config'
import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

export const staffPermissionProfileBindingConfig: EntityConfigFactory<StaffPermissionProfileBinding> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.staffPermissionProfileBindings,
    tenant: directSchoolTenant(),
    resource: 'staffPermissionProfileBindings',
    atomicExecution,
  })
