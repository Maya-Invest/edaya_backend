import type { AccessRole } from '../../../entities/school/access-role'
import type { EntityConfigFactory } from '../../../shared'
import { Permission } from '../../../authorization'
import { directPermissionEntityConfig } from '../../../shared'

export const accessRoleConfig: EntityConfigFactory<AccessRole> = input =>
  directPermissionEntityConfig(
    input,
    input.repositories.accessRoles,
    Permission.ACCESS_CONTROL_READ,
    Permission.ACCESS_CONTROL_CONFIGURE,
  )
