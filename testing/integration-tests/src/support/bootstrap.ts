import { afterAll, setDefaultTimeout } from 'bun:test'
import { releaseSharedSeededFixtures } from './seeded-route-test-context'

const API_SEED_TEST_TIMEOUT_MS = 120_000

setDefaultTimeout(API_SEED_TEST_TIMEOUT_MS)

afterAll(async () => {
  await releaseSharedSeededFixtures()
})
