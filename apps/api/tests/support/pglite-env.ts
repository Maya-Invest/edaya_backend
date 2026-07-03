/* eslint-disable node/no-process-env -- test harness may load optional dotenv files */
import { type Environment, parseEnv } from "@/runtime";
import { loadDotenvFiles } from "@/runtime/shared/env/local-loader";

if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
  loadDotenvFiles();
}

export const pgliteTestEnvInput = {
  RUNTIME: "in-memory",
  NODE_ENV: "development",
  PORT: 9999,
  LOG_LEVEL: "silent",
  DATABASE_URL: "pglite",
  AUTH_DATABASE_PATH: ":memory:",
  BETTER_AUTH_SECRET: "super-secret-placeholder-key-for-local-testing",
  BETTER_AUTH_URL: "http://localhost:9999",
  ACCOUNT_INVITATIONS_ENABLED: false,
} as const;

export function createPgliteTestEnv(overrides: Record<string, unknown> = {}): Environment {
  return parseEnv({ ...pgliteTestEnvInput, ...overrides });
}

/** Default in-memory test environment for API integration and seed tests. */
export const pgliteEnv = createPgliteTestEnv();
