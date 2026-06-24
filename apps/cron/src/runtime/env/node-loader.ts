/* eslint-disable node/no-process-env */
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseRuntimeEnv } from "@/runtime/env/schema";
import type { Environment } from "@/runtime/env/schema";
import { resolveRepoLocalDatabaseUrl } from "@/runtime/env/repo-root";

function resolveCronRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
}

function normalizeLocalDatabaseUrl(env: Environment): Environment {
  return {
    ...env,
    DATABASE_URL: resolveRepoLocalDatabaseUrl(env.DATABASE_URL),
  };
}

export function loadDotenvFiles(): void {
  const cronRoot = resolveCronRoot();
  const apiEnvPath = path.resolve(cronRoot, "../api/.env");
  const cronEnvPath = path.resolve(cronRoot, ".env");

  if (existsSync(apiEnvPath)) {
    expand(config({ path: apiEnvPath }));
  }
  if (existsSync(cronEnvPath)) {
    expand(config({ path: cronEnvPath, override: true }));
  }
}

export function loadNodeProcessEnv(): Environment {
  if (process.env.NODE_ENV !== "production") {
    loadDotenvFiles();
  }
  return normalizeLocalDatabaseUrl(parseRuntimeEnv(process.env, "node"));
}
