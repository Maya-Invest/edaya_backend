import type { ActorMetadata } from '@edaya/authorization'
import type { NotificationEnqueueInput, NotificationGatewayPort } from '@edaya/core'
import type { SchoolRepositories } from '@edaya/service'
import type { EntityBusinessHooks, ManagedEntityServiceConfig } from '../../services/entities/managed-entity-service'
import type { CoreEntityKey } from '../../services/runtime/core-entity-map'
import type { NotificationTemplateService } from './templates/notification-template-service'
import { deliverNotificationFromEnqueueInput } from './delivery/deliver-notification'

export interface NotificationTriggerContext {
  notificationGateway: NotificationGatewayPort
  repositories: SchoolRepositories
  templateService: NotificationTemplateService
  actor: ActorMetadata
}

export type NotificationTriggerPredicate<T> = (
  entity: T,
  existing: T | undefined,
) => boolean

export type NotificationTriggerResolver<T> = (
  entity: T,
  existing: T | undefined,
  context: NotificationTriggerContext,
) => Promise<NotificationEnqueueInput | null> | NotificationEnqueueInput | null

export interface NotificationTriggerRegistration<T = unknown> {
  entityKey: CoreEntityKey
  predicate: NotificationTriggerPredicate<T>
  resolver: NotificationTriggerResolver<T>
}

export class NotificationTriggerRegistry {
  private readonly triggers = new Map<CoreEntityKey, NotificationTriggerRegistration[]>()

  register<T>(registration: NotificationTriggerRegistration<T>): void {
    const existing = this.triggers.get(registration.entityKey) ?? []
    existing.push(registration as NotificationTriggerRegistration)
    this.triggers.set(registration.entityKey, existing)
  }

  getTriggers(entityKey: CoreEntityKey): readonly NotificationTriggerRegistration[] {
    return this.triggers.get(entityKey) ?? []
  }

  hasTriggers(entityKey: CoreEntityKey): boolean {
    return (this.triggers.get(entityKey)?.length ?? 0) > 0
  }

  clear(): void {
    this.triggers.clear()
  }
}

export const notificationTriggerRegistry = new NotificationTriggerRegistry()

export function createNotificationPostSaveHook(
  entityKey: CoreEntityKey,
  notificationGateway: NotificationGatewayPort,
  templateService: NotificationTemplateService,
): NonNullable<EntityBusinessHooks<unknown>['postSave']> {
  return async (entity, existing, repositories, actor) => {
    const triggers = notificationTriggerRegistry.getTriggers(entityKey)
    if (triggers.length === 0) {
      return
    }

    const context: NotificationTriggerContext = {
      notificationGateway,
      repositories,
      templateService,
      actor,
    }

    for (const trigger of triggers) {
      if (!trigger.predicate(entity, existing)) {
        continue
      }
      const input = await trigger.resolver(entity, existing, context)
      if (input) {
        await deliverNotificationFromEnqueueInput({
          notificationGateway,
          repositories,
        }, input)
      }
    }
  }
}

export function withNotificationPostSaveHook<T>(
  entityKey: CoreEntityKey,
  config: ManagedEntityServiceConfig<T>,
  notificationGateway: NotificationGatewayPort,
  templateService: NotificationTemplateService,
): ManagedEntityServiceConfig<T> {
  if (!notificationTriggerRegistry.hasTriggers(entityKey)) {
    return config
  }

  const notificationPostSave = createNotificationPostSaveHook(entityKey, notificationGateway, templateService)
  const existingPostSave = config.hooks?.postSave

  return {
    ...config,
    hooks: {
      ...config.hooks,
      postSave: async (entity, existing, repositories, actor) => {
        await existingPostSave?.(entity, existing, repositories, actor)
        await notificationPostSave(entity, existing, repositories, actor)
      },
    },
  }
}
