import {
  createInMemoryFileStorage,
  noOpFileStorage,
} from "@edaya/core";
import {
  createLocalFileStorageFromEnv,
  resolveLocalFileStorageConfig,
} from "@edaya/adaptor-local-fs";
import {
  createR2FileStorageFromEnv,
  isR2FileStorageConfigured,
  resolveR2EndpointFromEnv,
} from "@edaya/adaptor-r2";
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

  switch (env.RUNTIME) {
    case "local": {
      if (isPersistedLocalDataDeployment(env)) {
        const persistDir = resolveRepoLocalDataPath(env.LOCAL_FILES_ROOT ?? ".data/files");
        if (env.LOG_LEVEL !== "silent") {
          logger?.info(
            {
              baseUrl: env.BETTER_AUTH_URL,
              rootDir: persistDir,
            },
            "Using persisted local dev file storage",
          );
        }
        return createLocalDevFileStorage(env.BETTER_AUTH_URL, { persistDir });
      }

      const localConfig = resolveLocalFileStorageConfig(env);
      if (env.LOG_LEVEL !== "silent") {
        logger?.info(
          {
            baseUrl: localConfig.baseUrl,
            rootDir: localConfig.rootDir,
          },
          "Using local file storage",
        );
      }
      return createLocalFileStorageFromEnv({ env });
    }
    case "in-memory":
      return createInMemoryFileStorage();
    case "worker": {
      if (!isR2FileStorageConfigured(env)) {
        if (env.LOG_LEVEL === "silent") {
          return noOpFileStorage;
        }
        throw new Error(
          "RUNTIME=worker requires R2 file storage (R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_ENDPOINT or R2_ACCOUNT_ID).",
        );
      }
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
    default:
      return noOpFileStorage;
  }
}
