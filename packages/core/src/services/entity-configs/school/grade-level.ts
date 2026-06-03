import type { GradeLevel } from '../../../entities/school/grade-level'
import type { EntityConfigFactory } from '../../../shared/common'
import { directEntityConfig } from '../../../shared/common'

export const gradeLevelConfig: EntityConfigFactory<GradeLevel> = input =>
  directEntityConfig(input, input.repositories.gradeLevels, 'queries.read_class_directory', 'setup.manage')
