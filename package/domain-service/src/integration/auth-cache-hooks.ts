import type { AuthCacheInvalidationPort } from '@edaya/authorization'
import type { CoreEntityKey, CoreEntityMap } from '@edaya/core'
import type { ManagedEntityServiceConfig } from '../services/entities/managed-entity-service'
import { invalidateAuthCacheForEvents, isAuthCacheInvalidationEntity, resolveAuthCacheInvalidationEvents } from '@edaya/authorization'

export const noOpAuthCacheInvalidationPort: AuthCacheInvalidationPort = {
  invalidateForEvent: () => {},
}

export function withAuthCacheLifecycleHooks<Key extends CoreEntityKey>(
  entityKey: Key,
  config: ManagedEntityServiceConfig<CoreEntityMap[Key]>,
  port: AuthCacheInvalidationPort,
): ManagedEntityServiceConfig<CoreEntityMap[Key]> {
  if (!isAuthCacheInvalidationEntity(entityKey)) {
    return config
  }

  const invalidate = (entity: unknown) => {
    invalidateAuthCacheForEvents(
      resolveAuthCacheInvalidationEvents(entityKey, entity),
      port,
    )
  }

  const existingPostSave = config.hooks?.postSave
  const existingPostDelete = config.hooks?.postDelete

  return {
    ...config,
    hooks: {
      ...config.hooks,
      postSave: async (entity, existing, repositories, actor) => {
        await existingPostSave?.(entity, existing, repositories, actor)
        invalidate(entity)
      },
      postDelete: async (entity, repositories, actor) => {
        await existingPostDelete?.(entity, repositories, actor)
        invalidate(entity)
      },
    },
  }
}
