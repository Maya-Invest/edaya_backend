import { createR2FileStorageFromEnv, isR2FileStorageConfigured } from '@edaya/adaptor-r2'
import type { FileStoragePort } from '@edaya/core'
import { createInMemoryFileStorage, noOpFileStorage } from '@edaya/core'
import type { Logger } from 'pino'
import type { Environment } from '@/runtime/env/schema'

export function resolveFileStorage(
  env: Environment | undefined,
  logger?: Logger,
): FileStoragePort {
  if (!env || env.LOG_LEVEL === 'silent') {
    return noOpFileStorage
  }

  if (isR2FileStorageConfigured(env)) {
    return createR2FileStorageFromEnv({ env })
  }

  if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
    logger?.info('R2 not configured — using in-memory file storage')
    return createInMemoryFileStorage()
  }

  logger?.warn('R2 not configured in non-development runtime — file storage disabled')
  return noOpFileStorage
}
