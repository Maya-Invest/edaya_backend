import { resolveRepoLocalDataPath } from "@/runtime/env/repo-root";
import type { Environment } from "@/runtime/env/schema";

const DEFAULT_DEV_FILE_STORAGE_ROOT = ".data/file-storage";

export function resolveLocalDevFileStorageRoot(env: Environment): string {
  return resolveRepoLocalDataPath(env.FILE_STORAGE_DEV_ROOT ?? DEFAULT_DEV_FILE_STORAGE_ROOT);
}

export function shouldUseLocalDevFileStorage(env: Environment): boolean {
  return env.RUNTIME === "node"
    && env.NODE_ENV === "development"
    && env.LOG_LEVEL !== "silent";
}
