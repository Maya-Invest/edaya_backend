import type { Environment } from '@/lib/runtime/env'
import { parseEnv } from '@/lib/runtime/env'

export const apiPgliteTestEnvInput = {
  RUNTIME: 'node',
  NODE_ENV: 'development',
  PORT: 9999,
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'pglite',
  AUTH_DATABASE_PATH: ':memory:',
  BETTER_AUTH_SECRET: 'super-secret-placeholder-key-for-local-testing',
  BETTER_AUTH_URL: 'http://localhost:9999',
} as const

export function createApiPgliteTestEnv(overrides: Record<string, unknown> = {}): Environment {
  return parseEnv({ ...apiPgliteTestEnvInput, ...overrides })
}

/** Ephemeral PGlite env for API route + seed integration tests. */
export const apiPgliteEnv = createApiPgliteTestEnv()
