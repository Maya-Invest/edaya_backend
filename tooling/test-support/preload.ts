import { afterAll, afterEach } from 'bun:test'
import { closeServiceTestDatabases, resetServiceTestDatabases } from '../../package/domain-service/tests/support/database-pool'

// Preloaded hooks run for every test file, including files sharing cached helpers.
afterEach(resetServiceTestDatabases)
afterAll(closeServiceTestDatabases)
