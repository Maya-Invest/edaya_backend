import type { SchoolNotificationTemplates } from '@edaya/core'
import type { EntityConfigFactory } from '../../entity-config'
import { denyResourceAccess, SchoolStructureOperations } from '@edaya/authorization'
import { config, noopReadAccess, operationModule, read, write } from '../../entity-config'

import { directSchoolTenant } from '../../entity-config/tenant'

async function denyTemplateEntityWrite(): Promise<void> {
  denyResourceAccess()
}

// Extracted from domain/messaging/school-notification-templates.ts (PR3)
export const schoolNotificationTemplatesConfig: EntityConfigFactory<SchoolNotificationTemplates> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.schoolNotificationTemplates,
    tenant: directSchoolTenant(),
    read: read(operationModule(SchoolStructureOperations.lifecycleManage), noopReadAccess),
    write: write(
      operationModule(SchoolStructureOperations.lifecycleManage),
      denyTemplateEntityWrite,
      denyTemplateEntityWrite,
    ),
    atomicExecution,
  })
