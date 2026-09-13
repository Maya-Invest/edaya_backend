import type { MessageDelivery } from '@edaya/core'
import type { EntityConfigFactory } from '../../entity-config'

import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

// Extracted from domain/messaging/message-delivery.ts (PR3)
export const messageDeliveryConfig: EntityConfigFactory<MessageDelivery> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.messageDeliveries,
    tenant: directSchoolTenant(),
    resource: 'messageDeliveries',

    atomicExecution,
  })
