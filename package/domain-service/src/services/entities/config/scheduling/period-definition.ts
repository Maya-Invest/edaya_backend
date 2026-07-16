import type { PeriodDefinition } from '@edaya/core'
import type { EntityConfigFactory } from '../../entity-config'
import { SchoolStructureOperations, WorkspaceOperations } from '@edaya/authorization'
import { authorizeDeleteByReadAccess, authorizeExistingById, config, noopReadAccess, operationModule, read, write } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

// Extracted from domain/scheduling/period-definition.ts (PR3)
export const periodDefinitionConfig: EntityConfigFactory<PeriodDefinition> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.periodDefinitions,
    tenant: directSchoolTenant(),
    read: read(operationModule(WorkspaceOperations.read), noopReadAccess),
    write: write(
      operationModule(SchoolStructureOperations.configure),
      authorizeExistingById(noopReadAccess),
      authorizeDeleteByReadAccess(noopReadAccess),
    ),
    atomicExecution,
  })
