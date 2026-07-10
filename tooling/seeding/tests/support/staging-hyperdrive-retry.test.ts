import { describe, expect, it } from 'bun:test'
import { ApiError } from '../../src/generated/api-client'
import { withStagingHyperdriveRetry } from '../../src/transport/http/staging-hyperdrive-retry'

describe('withStagingHyperdriveRetry', () => {
  it('does not retry when not staging', async () => {
    let attempts = 0
    await expect(withStagingHyperdriveRetry(false, async () => {
      attempts += 1
      throw new ApiError(403, { message: 'Operation is not permitted' })
    })).rejects.toBeInstanceOf(ApiError)
    expect(attempts).toBe(1)
  })

  it('retries staging 403 then succeeds', async () => {
    let attempts = 0
    const result = await withStagingHyperdriveRetry(true, async () => {
      attempts += 1
      if (attempts < 3) {
        throw new Error('Core command failed for linkGuardianToStudent: 403 Operation is not permitted')
      }
      return 'ok'
    })
    expect(result).toBe('ok')
    expect(attempts).toBe(3)
  })
})
