import type { ObjectStorage } from '../ports/object-storage.ts'
import { createR2ObjectStorage } from './r2-object-storage.ts'

export interface R2Environment {
  readonly R2_ACCESS_KEY_ID?: string
  readonly R2_SECRET_ACCESS_KEY?: string
  readonly R2_BUCKET_NAME?: string
  readonly R2_ACCOUNT_ID?: string
  readonly R2_ENDPOINT?: string
}

export interface ConfiguredR2Environment {
  readonly R2_ACCESS_KEY_ID: string
  readonly R2_SECRET_ACCESS_KEY: string
  readonly R2_BUCKET_NAME: string
  readonly R2_ACCOUNT_ID?: string
  readonly R2_ENDPOINT?: string
}

export function isR2ObjectStorageConfigured(
  env: R2Environment | undefined,
): env is ConfiguredR2Environment {
  return Boolean(
    env?.R2_ACCESS_KEY_ID
    && env?.R2_SECRET_ACCESS_KEY
    && env?.R2_BUCKET_NAME
    && (env.R2_ENDPOINT || env.R2_ACCOUNT_ID),
  )
}

export function createR2ObjectStorageFromEnv(env: R2Environment): ObjectStorage {
  if (!isR2ObjectStorageConfigured(env))
    throw new Error('R2 object storage env is incomplete')

  return createR2ObjectStorage({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucketName: env.R2_BUCKET_NAME,
    ...(env.R2_ACCOUNT_ID === undefined ? {} : { accountId: env.R2_ACCOUNT_ID }),
    ...(env.R2_ENDPOINT === undefined ? {} : { endpoint: env.R2_ENDPOINT }),
  })
}

/** Returns null when R2 is not configured (inline delivery still works). */
export function createObjectStorageFromEnv(env: R2Environment): ObjectStorage | null {
  if (!isR2ObjectStorageConfigured(env))
    return null
  return createR2ObjectStorageFromEnv(env)
}
