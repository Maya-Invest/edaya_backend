import { setDefaultTimeout } from 'bun:test'
import { getIntegrationTestConfig } from './integration-test-config'

const POSTGRES_TEST_TIMEOUT_MS = 120_000
const API_SEED_TEST_TIMEOUT_MS = 120_000

const config = getIntegrationTestConfig()

if (config.runRemotePostgres) {
  setDefaultTimeout(POSTGRES_TEST_TIMEOUT_MS)
}
else {
  setDefaultTimeout(API_SEED_TEST_TIMEOUT_MS)
}

export { config as integrationTestConfig }
