import type { GradeLevel } from '../../../entities/school/grade-level'
import type { EntityConfigFactory } from '../../../shared'
import { Permission } from '../../../authorization'
import { directPermissionEntityConfig } from '../../../shared'

export const gradeLevelConfig: EntityConfigFactory<GradeLevel> = input =>
  directPermissionEntityConfig(
    input,
    input.repositories.gradeLevels,
    Permission.QUERY_CLASS_DIRECTORY_READ,
    Permission.SCHOOL_STRUCTURE_CONFIGURE,
  )
