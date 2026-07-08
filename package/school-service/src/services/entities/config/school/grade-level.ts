import type { GradeLevel } from '@edaya/core'
import type { EntityConfigFactory } from '../../entity-config'
import { SchoolStructureOperations } from '@edaya/authorization'
import { authorizeDeleteByReadAccess, authorizeExistingById, config, noopReadAccess, operationModule, read, write } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

// Extracted from domain/school/grade-level.ts (PR3)
export const gradeLevelConfig: EntityConfigFactory<GradeLevel> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.gradeLevels,
    tenant: directSchoolTenant(),
    read: read(operationModule(SchoolStructureOperations.classGroupRead), noopReadAccess),
    write: write(
      operationModule(SchoolStructureOperations.configure),
      authorizeExistingById(noopReadAccess),
      authorizeDeleteByReadAccess(noopReadAccess),
    ),
    atomicExecution,
  })
