import { type Environment, parseEnv } from "@/lib/runtime/env";

export const pgliteTestEnvInput = {
  RUNTIME: "node",
  NODE_ENV: "development",
  PORT: 9999,
  LOG_LEVEL: "silent",
  DATABASE_URL: "pglite",
  AUTH_DATABASE_PATH: ":memory:",
  BETTER_AUTH_SECRET: "super-secret-placeholder-key-for-local-testing",
  BETTER_AUTH_URL: "http://localhost:9999",
} as const;

export function createPgliteTestEnv(overrides: Record<string, unknown> = {}): Environment {
  return parseEnv({ ...pgliteTestEnvInput, ...overrides });
}

/** Default Node + PGlite test environment for API integration and seed tests. */
export const pgliteEnv = createPgliteTestEnv();
