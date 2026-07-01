import { isR2FileStorageConfigured } from "@edaya/adaptor-r2";
import { type Environment, parseEnv } from "@/runtime";
import { loadDotenvFiles } from "@/runtime/shared/env/local-loader";

const R2_ENV_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ENDPOINT",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
] as const;

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

function readR2EnvOverrides(): Record<string, string> {
  const overrides: Record<string, string> = {};

  for (const key of R2_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (value) {
      overrides[key] = value;
    }
  }

  if (
    overrides.R2_ACCESS_KEY_ID
    && overrides.R2_SECRET_ACCESS_KEY
    && !overrides.R2_BUCKET_NAME
    && (overrides.R2_ENDPOINT || overrides.R2_ACCOUNT_ID)
  ) {
    overrides.R2_BUCKET_NAME = "edaya-files-dev";
  }

  return overrides;
}

export function createPgliteTestEnv(overrides: Record<string, unknown> = {}): Environment {
  return parseEnv({ ...pgliteTestEnvInput, ...readR2EnvOverrides(), ...overrides });
}

/** Default in-memory test environment for API integration and seed tests. */
export const pgliteEnv = createPgliteTestEnv();

/** True when integration tests can exercise presigned upload/download through R2. */
export function isR2ConfiguredForTests(): boolean {
  return isR2FileStorageConfigured(pgliteEnv);
}
