import type { MessageDelivery } from '@edaya/core'
import type { EntityConfigFactory } from '../../entity-config'
import { CommunicationsOperations } from '@edaya/authorization'
import { config, noopDeleteAccess, noopReadAccess, noopSaveAccess, operationModule, read, write } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

// Extracted from domain/messaging/message-delivery.ts (PR3)
export const messageDeliveryConfig: EntityConfigFactory<MessageDelivery> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.messageDeliveries,
    tenant: directSchoolTenant(),
    read: read(operationModule(CommunicationsOperations.read), noopReadAccess),
    write: write(operationModule(CommunicationsOperations.create), noopSaveAccess, noopDeleteAccess),
    atomicExecution,
  })
