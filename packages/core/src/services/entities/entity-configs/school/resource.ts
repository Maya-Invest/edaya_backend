import type { Resource } from '../../../../entities/school/resource'
import type { EntityConfigFactory } from '../../../shared/common'
import { directEntityConfig } from '../../../shared/common'

export const resourceConfig: EntityConfigFactory<Resource> = input =>
  directEntityConfig(input, input.repositories.resources, 'resources.read', 'resources.manage')
