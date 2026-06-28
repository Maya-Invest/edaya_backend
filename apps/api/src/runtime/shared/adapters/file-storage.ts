import {
  createInMemoryFileStorage,
  createLocalDevFileStorage,
  noOpFileStorage,
} from "@edaya/adaptor-file";
import { createR2FileStorageFromEnv, isR2FileStorageConfigured } from "@edaya/adaptor-r2";
import type { FileStoragePort, LoggerPort } from "@edaya/core";
import { shouldUseLocalDevFileStorage as localShouldUseLocalDevFileStorage } from "@/runtime/local/profile";
import { resolveRepoLocalDataPath } from "@/runtime/shared/env/repo-root";
import type { Environment } from "@/runtime/shared/env/schema";

const DEFAULT_DEV_FILE_STORAGE_ROOT = ".data/file-storage";

export function resolveLocalDevFileStorageRoot(env: Environment): string {
  return resolveRepoLocalDataPath(env.FILE_STORAGE_DEV_ROOT ?? DEFAULT_DEV_FILE_STORAGE_ROOT);
}

export function resolveFileStorage(
  env: Environment | undefined,
  logger?: LoggerPort,
): FileStoragePort {
  if (!env || env.LOG_LEVEL === "silent") {
    return noOpFileStorage;
  }

  if (isR2FileStorageConfigured(env)) {
    return createR2FileStorageFromEnv({ env });
  }

  if (env.RUNTIME === "local" && localShouldUseLocalDevFileStorage(env)) {
    const rootDir = resolveLocalDevFileStorageRoot(env);
    logger?.info({ rootDir }, "Using local dev file storage");
    return createLocalDevFileStorage({
      rootDir,
      publicBaseUrl: env.BETTER_AUTH_URL,
      signingSecret: env.BETTER_AUTH_SECRET,
    });
  }

  if (env.RUNTIME === "local") {
    logger?.info("R2 not configured — using in-memory file storage");
    return createInMemoryFileStorage();
  }

  logger?.warn("R2 not configured in non-development runtime — file storage disabled");
  return noOpFileStorage;
}
