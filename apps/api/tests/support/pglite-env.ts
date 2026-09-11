/* eslint-disable node/no-process-env -- test harness may load optional dotenv files */
import { parseEnv } from "@/runtime";
import type { Environment } from "@/runtime";
import { loadDotenvFiles } from "@/runtime/shared/env/local-loader";

if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
  loadDotenvFiles();
}

export const pgliteTestEnvInput = {
  RUNTIME: "in-memory",
  NODE_ENV: "test",
  PORT: 9999,
  LOG_LEVEL: "silent",
  DATABASE_URL: "pglite",
  SCHOOL_API_ORIGIN: "http://localhost:9999",
  IDENTITY_ISSUER: "http://localhost:9900",
  IDENTITY_DIRECTORY_URL: "http://localhost:9900",
  IDENTITY_DIRECTORY_SECRET: "test-directory-secret",
  LOCAL_FILES_SECRET: "test-local-files-secret",
  ACCOUNT_INVITATIONS_ENABLED: false,
  ALLOW_PUBLIC_SCHOOL_REGISTRATION: true,
} as const;

export function createPgliteTestEnv(overrides: Record<string, unknown> = {}): Environment {
  return parseEnv({ ...pgliteTestEnvInput, ...overrides });
}

/** Default in-memory test environment for API integration and seed tests. */
export const pgliteEnv = createPgliteTestEnv();
