import { describe, expect, test } from 'bun:test'
import {
  isLocalDevApiUrl,
  parseSkipProfilePhotosFlag,
  resolveProfilePhotoSeedPlan,
} from '../../src/diagnostics/profile-photo-preflight'

describe('profile photo preflight', () => {
  test('parseSkipProfilePhotosFlag detects --skip-profile-photos', () => {
    expect(parseSkipProfilePhotosFlag(['node', 'seed-http.ts', 'all'])).toBe(false)
    expect(parseSkipProfilePhotosFlag(['node', 'seed-http.ts', 'all', '--skip-profile-photos'])).toBe(true)
  })

  test('isLocalDevApiUrl recognizes loopback hosts', () => {
    expect(isLocalDevApiUrl('http://localhost:9999')).toBe(true)
    expect(isLocalDevApiUrl('http://127.0.0.1:9999')).toBe(true)
    expect(isLocalDevApiUrl('https://staging.api.edaya.app')).toBe(false)
  })

  test('resolveProfilePhotoSeedPlan skips when flag is set', async () => {
    const plan = await resolveProfilePhotoSeedPlan({
      apiBaseUrl: 'http://localhost:9999',
      skipProfilePhotos: true,
    })
    expect(plan.seedProfilePhotos).toBe(false)
    expect(plan.reason).toContain('--skip-profile-photos')
  })

  test('resolveProfilePhotoSeedPlan seeds on remote APIs without probing local-files', async () => {
    const plan = await resolveProfilePhotoSeedPlan({
      apiBaseUrl: 'https://staging.api.edaya.app',
      skipProfilePhotos: false,
    })
    expect(plan.seedProfilePhotos).toBe(true)
  })
})
