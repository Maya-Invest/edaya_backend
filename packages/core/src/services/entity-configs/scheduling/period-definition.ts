import type { PeriodDefinition } from '../../../entities/scheduling/period-definition'
import type { EntityConfigFactory } from '../../../shared'
import { directEntityConfig } from '../../../shared'

export const periodDefinitionConfig: EntityConfigFactory<PeriodDefinition> = input =>
  directEntityConfig(input, input.repositories.periodDefinitions, 'queries.read_workspace', 'setup.manage')
