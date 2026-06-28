import {
  createInMemoryFileStorage,
  createLocalDevFileStorage,
  noOpFileStorage,
} from "@edaya/adaptor-file";
import { createR2FileStorageFromEnv, isR2FileStorageConfigured } from "@edaya/adaptor-r2";
import type { FileStoragePort } from "@edaya/core";
import type { Logger } from "pino";
import type { Environment } from "@/runtime/env/schema";
import {
  resolveLocalDevFileStorageRoot,
  shouldUseLocalDevFileStorage,
} from "@/runtime/shared/resolve-local-dev-file-storage";

export function resolveFileStorage(
  env: Environment | undefined,
  logger?: Logger,
): FileStoragePort {
  if (!env || env.LOG_LEVEL === "silent") {
    return noOpFileStorage;
  }

  if (isR2FileStorageConfigured(env)) {
    return createR2FileStorageFromEnv({ env });
  }

  if (shouldUseLocalDevFileStorage(env)) {
    logger?.info({ rootDir: resolveLocalDevFileStorageRoot(env) }, "Using local dev file storage");
    return createLocalDevFileStorage({
      rootDir: resolveLocalDevFileStorageRoot(env),
      publicBaseUrl: env.BETTER_AUTH_URL,
      signingSecret: env.BETTER_AUTH_SECRET,
    });
  }

  if (env.NODE_ENV === "development" || env.NODE_ENV === "test") {
    logger?.info("R2 not configured — using in-memory file storage");
    return createInMemoryFileStorage();
  }

  logger?.warn("R2 not configured in non-development runtime — file storage disabled");
  return noOpFileStorage;
}
