import type { Resource } from '../../../entities/school/resource'
import type { EntityConfigFactory } from '../../../shared'
import { directEntityConfig } from '../../../shared'

export const resourceConfig: EntityConfigFactory<Resource> = input =>
  directEntityConfig(input, input.repositories.resources, 'resources.read', 'resources.manage')
