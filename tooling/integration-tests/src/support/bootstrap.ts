import process from 'node:process'
import { afterAll, setDefaultTimeout } from 'bun:test'
import { releaseSharedSeededFixtures } from './seeded-route-test-context'

process.env.SEED_DATASET = process.env.SEED_DATASET ?? 'demo'

const API_SEED_TEST_TIMEOUT_MS = 120_000

setDefaultTimeout(API_SEED_TEST_TIMEOUT_MS)

afterAll(async () => {
  await releaseSharedSeededFixtures()
})
