import type { R2Environment } from "./types";
import { createR2FileStorage, resolveR2Endpoint } from "./r2-file-storage";
import type { R2FileStorageConfig } from "./r2-file-storage";

export interface ConfiguredR2Environment {
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_NAME: string;
  R2_ACCOUNT_ID?: string;
  R2_ENDPOINT?: string;
}

export interface CreateR2FileStorageFromEnvOptions {
  env: ConfiguredR2Environment;
}

export function resolveR2EndpointFromEnv(
  env: Pick<R2Environment, "R2_ACCOUNT_ID" | "R2_ENDPOINT">,
): string {
  return resolveR2Endpoint({
    accountId: env.R2_ACCOUNT_ID,
    endpoint: env.R2_ENDPOINT,
  });
}

export function isR2FileStorageConfigured(
  env: Partial<R2Environment> | undefined,
): env is ConfiguredR2Environment & ({ R2_ACCOUNT_ID: string } | { R2_ENDPOINT: string }) {
  return Boolean(
    env?.R2_ACCESS_KEY_ID
    && env?.R2_SECRET_ACCESS_KEY
    && env?.R2_BUCKET_NAME
    && (env?.R2_ENDPOINT || env?.R2_ACCOUNT_ID),
  );
}

export function createR2FileStorageFromEnv(
  options: CreateR2FileStorageFromEnvOptions,
): ReturnType<typeof createR2FileStorage> {
  const { env } = options;
  if (!isR2FileStorageConfigured(env)) {
    throw new Error("R2 file storage env is incomplete");
  }

  const config: R2FileStorageConfig = {
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucketName: env.R2_BUCKET_NAME,
    endpoint: env.R2_ENDPOINT,
  };
  return createR2FileStorage(config);
}
