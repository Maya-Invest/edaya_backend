import type { PeriodDefinition } from '@edaya/core'
import type { EntityConfigFactory } from '../../entity-config'

import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

// Extracted from domain/scheduling/period-definition.ts (PR3)
export const periodDefinitionConfig: EntityConfigFactory<PeriodDefinition> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.periodDefinitions,
    tenant: directSchoolTenant(),
    resource: 'periodDefinitions',

    atomicExecution,
  })
