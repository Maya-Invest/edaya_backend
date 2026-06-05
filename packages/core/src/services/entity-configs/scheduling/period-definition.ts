import type { PeriodDefinition } from '../../../entities/scheduling/period-definition'
import type { EntityConfigFactory } from '../../../shared'
import { Permission } from '../../../authorization'
import { directPermissionEntityConfig } from '../../../shared'

export const periodDefinitionConfig: EntityConfigFactory<PeriodDefinition> = input =>
  directPermissionEntityConfig(
    input,
    input.repositories.periodDefinitions,
    Permission.QUERY_WORKSPACE_READ,
    Permission.SCHOOL_STRUCTURE_CONFIGURE,
  )
