import type { GradeLevel } from '../../../entities/school/grade-level'
import type { EntityConfigFactory } from '../../../shared'
import { directEntityConfig } from '../../../shared'

export const gradeLevelConfig: EntityConfigFactory<GradeLevel> = input =>
  directEntityConfig(input, input.repositories.gradeLevels, 'queries.read_class_directory', 'setup.manage')
