import type { PeriodDefinition } from '../../../../entities/scheduling/period-definition'
import type { EntityConfigFactory } from '../../../shared/common'
import { directEntityConfig } from '../../../shared/common'

export const periodDefinitionConfig: EntityConfigFactory<PeriodDefinition> = input =>
  directEntityConfig(input, input.repositories.periodDefinitions, 'queries.read_workspace', 'setup.manage')
