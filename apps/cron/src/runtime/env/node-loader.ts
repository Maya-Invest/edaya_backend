/* eslint-disable node/no-process-env */
import { config } from "dotenv";
import { expand } from "dotenv-expand";
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
  expand(config({
    path: path.resolve(resolveCronRoot(), ".env"),
  }));
}

export function loadNodeProcessEnv(): Environment {
  if (process.env.NODE_ENV !== "production") {
    loadDotenvFiles();
  }
  return normalizeLocalDatabaseUrl(parseRuntimeEnv(process.env, "node"));
}
