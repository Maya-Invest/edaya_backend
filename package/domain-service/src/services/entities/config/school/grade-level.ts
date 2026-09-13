import type { GradeLevel } from '@edaya/core'
import type { EntityConfigFactory } from '../../entity-config'

import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

// Extracted from domain/school/grade-level.ts (PR3)
export const gradeLevelConfig: EntityConfigFactory<GradeLevel> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.gradeLevels,
    tenant: directSchoolTenant(),
    resource: 'gradeLevels',

    atomicExecution,
  })
