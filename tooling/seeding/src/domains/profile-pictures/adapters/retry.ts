import { ApiError } from '@maya-invest/edaya-api-client'

const transientStatuses = new Set([408, 429, 500, 502, 503, 504])
const transientCodes = new Set(['ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ETIMEDOUT', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT'])

/** Only for replayable upload operations using the same admitted identity and bytes. */
export async function retryPhotoOperation<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run()
    }
    catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
      if (attempt === 2 || !(error instanceof ApiError ? transientStatuses.has(error.status) : transientCodes.has(code)))
        throw error
      await Bun.sleep(250 * (attempt + 1))
    }
  }
}
