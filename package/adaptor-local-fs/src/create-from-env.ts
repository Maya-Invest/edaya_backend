import { createLocalFileStorage } from "./local-file-storage";
import type { LocalFileStorageConfig, LocalFileStorageEnvironment } from "./types";
import {
  DEFAULT_LOCAL_FILES_ROOT,
  DEFAULT_LOCAL_FILES_URL,
} from "./types";

export interface CreateLocalFileStorageFromEnvOptions {
  env: LocalFileStorageEnvironment;
}

export function resolveLocalFileStorageSecret(
  env: Pick<LocalFileStorageEnvironment, "LOCAL_FILES_SECRET" | "BETTER_AUTH_SECRET">,
): string {
  return env.LOCAL_FILES_SECRET ?? env.BETTER_AUTH_SECRET ?? "super-secret-placeholder-key-for-local-testing";
}

export function resolveLocalFileStorageConfig(
  env: LocalFileStorageEnvironment,
): LocalFileStorageConfig {
  return {
    baseUrl: env.LOCAL_FILES_URL ?? DEFAULT_LOCAL_FILES_URL,
    rootDir: env.LOCAL_FILES_ROOT ?? DEFAULT_LOCAL_FILES_ROOT,
    secret: resolveLocalFileStorageSecret(env),
    allowedOrigins: (env.TRUSTED_ORIGINS ?? "http://localhost:5173,http://localhost:4173")
      .split(",")
      .map(origin => origin.trim())
      .filter(Boolean),
  };
}

export function createLocalFileStorageFromEnv(
  options: CreateLocalFileStorageFromEnvOptions,
): ReturnType<typeof createLocalFileStorage> {
  return createLocalFileStorage(resolveLocalFileStorageConfig(options.env));
}
