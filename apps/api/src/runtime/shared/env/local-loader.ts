/* eslint-disable node/no-process-env */
import { loadLocalConfiguration } from "../../../../configuration/index.ts";
import { parseRuntimeEnv } from "@/runtime/shared/env/schema";
import type { Environment } from "@/runtime/shared/env/schema";
import {
  resolveRepoLocalDatabaseUrl,
} from "@/runtime/shared/env/repo-root";

function normalizeLocalDataPaths(env: Environment): Environment {
  return {
    ...env,
    DATABASE_URL: resolveRepoLocalDatabaseUrl(env.DATABASE_URL),
    AUTH_DATABASE_URL: resolveRepoLocalDatabaseUrl(env.AUTH_DATABASE_URL),
  };
}

/** Load tracked local configuration and validate the private secrets file. */
export function loadDotenvFiles(): void {
  loadLocalConfiguration(process.env);
}

function shouldLoadDotenvFiles(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** Load env for process runtimes (`local` and `in-memory`). */
export function loadLocalProcessEnv(): Environment {
  if (shouldLoadDotenvFiles()) {
    loadDotenvFiles();
  }

  return normalizeLocalDataPaths(parseRuntimeEnv(process.env));
}
