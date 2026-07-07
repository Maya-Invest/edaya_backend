import type { ManagedEntityServiceConfig } from '../../../application/entities/managed-entity-service'
import type { CoreEntityKey, CoreEntityMap } from '../../../application/runtime/core-entity-map'
import type { AuthCacheInvalidationPort } from '../../../ports/gateways/auth-cache-invalidation'
import { isAuthCacheInvalidationEntity, resolveAuthCacheInvalidationEvents } from './entity-events'
import { invalidateAuthCacheForEvents } from './invalidation-registry'

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
