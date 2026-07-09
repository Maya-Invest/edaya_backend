import { ApiError } from '../../generated/api-client'

const STAGING_READ_AFTER_WRITE_ATTEMPTS = 8
const STAGING_READ_AFTER_WRITE_BASE_DELAY_MS = 750

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isForbiddenCoreError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 403
  }

  if (error instanceof Error) {
    return /\b403\b/.test(error.message) && /not permitted/i.test(error.message)
  }

  return false
}

/**
 * School Hyperdrive may serve stale reads after writes; domain code maps misses to 403.
 * Retry briefly on staging only — do not use for local/prod seed paths.
 */
export async function withStagingHyperdriveRetry<T>(
  isStaging: boolean,
  action: () => Promise<T>,
): Promise<T> {
  if (!isStaging) {
    return action()
  }

  let lastError: unknown
  for (let attempt = 0; attempt < STAGING_READ_AFTER_WRITE_ATTEMPTS; attempt++) {
    try {
      return await action()
    }
    catch (error) {
      lastError = error
      if (!isForbiddenCoreError(error) || attempt === STAGING_READ_AFTER_WRITE_ATTEMPTS - 1) {
        throw error
      }
      await sleep(STAGING_READ_AFTER_WRITE_BASE_DELAY_MS * (attempt + 1))
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}
