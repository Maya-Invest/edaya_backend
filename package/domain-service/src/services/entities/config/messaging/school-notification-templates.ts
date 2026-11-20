import type { SchoolNotificationTemplates } from '@edaya/core'
import type { EntityConfigFactory } from '../../entity-config'

import { config } from '../../entity-config'

import { directSchoolTenant } from '../../entity-config/tenant'

// Extracted from domain/messaging/school-notification-templates.ts (PR3)
export const schoolNotificationTemplatesConfig: EntityConfigFactory<SchoolNotificationTemplates> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.schoolNotificationTemplates,
    tenant: directSchoolTenant(),
    resource: 'schoolNotificationTemplates',

    atomicExecution,
  })
