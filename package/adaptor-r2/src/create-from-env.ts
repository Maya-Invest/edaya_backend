import type { R2Environment } from './types'
import { createR2FileStorage, type R2FileStorageConfig } from './r2-file-storage'

export interface CreateR2FileStorageFromEnvOptions {
  env: Required<R2Environment>
}

export function isR2FileStorageConfigured(
  env: Partial<CreateR2FileStorageFromEnvOptions['env']> | undefined,
): env is CreateR2FileStorageFromEnvOptions['env'] {
  return Boolean(
    env?.R2_ACCOUNT_ID
    && env?.R2_ACCESS_KEY_ID
    && env?.R2_SECRET_ACCESS_KEY
    && env?.R2_BUCKET_NAME,
  )
}

export function createR2FileStorageFromEnv(
  options: CreateR2FileStorageFromEnvOptions,
): ReturnType<typeof createR2FileStorage> {
  const { env } = options
  if (!isR2FileStorageConfigured(env)) {
    throw new Error('R2 file storage env is incomplete')
  }

  const config: R2FileStorageConfig = {
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucketName: env.R2_BUCKET_NAME,
  }
  return createR2FileStorage(config)
}
