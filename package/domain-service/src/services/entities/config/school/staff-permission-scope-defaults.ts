import type { StaffPermissionScopeDefaults } from '@edaya/core'
import type { EntityConfigFactory } from '../../entity-config'
import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

export const staffPermissionScopeDefaultsConfig: EntityConfigFactory<StaffPermissionScopeDefaults> = ({ repositories, atomicExecution }) => config({
  repository: repositories.staffPermissionScopeDefaults,
  tenant: directSchoolTenant(),
  resource: 'staffPermissionScopeDefaults',
  atomicExecution,
})
