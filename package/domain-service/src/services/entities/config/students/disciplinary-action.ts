import type { DisciplinaryAction } from '@edaya/core'
import type { EntityConfigFactory } from '../../entity-config'
import { DisciplineOperations } from '@edaya/authorization'
import { authorizeDeleteByReadAccess, authorizeExistingById, config, noopReadAccess, operationModule, read, write } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

// Extracted from domain/students/disciplinary-action.ts (PR3)
export const disciplinaryActionConfig: EntityConfigFactory<DisciplinaryAction> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.disciplinaryActions,
    tenant: directSchoolTenant(),
    read: read(operationModule(DisciplineOperations.read), noopReadAccess),
    write: write(
      operationModule(DisciplineOperations.validate),
      authorizeExistingById(noopReadAccess),
      authorizeDeleteByReadAccess(noopReadAccess),
    ),
    atomicExecution,
  })
