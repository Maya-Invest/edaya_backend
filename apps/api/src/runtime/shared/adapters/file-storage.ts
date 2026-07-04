import {
  noOpFileStorage,
} from "@edaya/core";
import { createR2FileStorageFromEnv, isR2FileStorageConfigured, resolveR2EndpointFromEnv } from "@edaya/adaptor-r2";
import type { FileStoragePort, LoggerPort } from "@edaya/core";
import type { Environment } from "@/runtime/shared/env/schema";
import { isPersistedLocalDataDeployment } from "@/dev/persisted-local-data";
import { createLocalDevFileStorage } from "@/runtime/shared/adapters/local-dev-file-storage";
import { resolveRepoLocalDataPath } from "@/runtime/shared/env/repo-root";

export function resolveFileStorage(
  env: Environment | undefined,
  logger?: LoggerPort,
): FileStoragePort {
  if (!env) {
    return noOpFileStorage;
  }

  if (isR2FileStorageConfigured(env)) {
    logger?.info(
      {
        bucket: env.R2_BUCKET_NAME,
        endpoint: resolveR2EndpointFromEnv(env),
        ...(env.R2_ACCOUNT_ID ? { accountId: env.R2_ACCOUNT_ID } : {}),
      },
      "Using R2 file storage",
    );
    return createR2FileStorageFromEnv({ env });
  }

  if (env.RUNTIME === "in-memory" || env.RUNTIME === "local") {
    const persistDir = env.RUNTIME === "local" && isPersistedLocalDataDeployment(env)
      ? resolveRepoLocalDataPath(".data/files")
      : undefined;
    if (env.LOG_LEVEL !== "silent") {
      logger?.info(
        persistDir
          ? "R2 not configured — using persisted local file storage (.data/files)"
          : "R2 not configured — using in-memory file storage",
      );
    }
    return createLocalDevFileStorage(env.BETTER_AUTH_URL, { persistDir });
  }

  if (env.LOG_LEVEL === "silent") {
    return noOpFileStorage;
  }

  logger?.warn("R2 not configured in non-development runtime — file storage disabled");
  return noOpFileStorage;
}
