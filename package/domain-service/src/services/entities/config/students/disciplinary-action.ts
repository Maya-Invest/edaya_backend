import type { DisciplinaryAction } from '@edaya/core'
import type { EntityConfigFactory } from '../../entity-config'

import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

// Extracted from domain/students/disciplinary-action.ts (PR3)
export const disciplinaryActionConfig: EntityConfigFactory<DisciplinaryAction> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.disciplinaryActions,
    tenant: directSchoolTenant(),
    resource: 'disciplinaryActions',

    atomicExecution,
  })
