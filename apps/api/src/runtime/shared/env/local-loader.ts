/* eslint-disable node/no-process-env */
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseRuntimeEnv } from "@/runtime/shared/env/schema";
import type { Environment } from "@/runtime/shared/env/schema";
import {
  resolveRepoLocalDatabaseUrl,
} from "@/runtime/shared/env/repo-root";

function resolveApiRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
}

function normalizeLocalDataPaths(env: Environment): Environment {
  return {
    ...env,
    DATABASE_URL: resolveRepoLocalDatabaseUrl(env.DATABASE_URL),
  };
}

function loadEnvFile(fileName: string, options?: { override?: boolean }): void {
  expand(config({
    path: path.resolve(resolveApiRoot(), fileName),
    override: options?.override ?? false,
  }));
}

/** Load `apps/api/.env` for process runtimes (`bun repo dev`, tests, cron-local). */
export function loadDotenvFiles(): void {
  loadEnvFile(process.env.EDAYA_LOCAL_ENV_FILE ?? ".env");
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
