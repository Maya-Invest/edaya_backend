import { unlinkSync } from "node:fs";
import { buildInMemoryApiRuntime } from "@/runtime/in-memory/build-runtime";
import { buildLocalApiRuntime } from "@/runtime/local/build-runtime";
import { resolveRepoLocalDataPath } from "@/runtime/shared/env/repo-root";
import { createRuntimeRegistry } from "@/runtime/shared/process-registry";
import { runMigrationsOnStartup as localRunMigrationsOnStartup } from "@/runtime/local/profile";
import type { Environment } from "@/runtime/shared/env/schema";
import type { ApiRuntime } from "@/runtime/types";

const DEFAULT_AUTH_DATABASE_PATH = resolveRepoLocalDataPath(".data/auth.sqlite");

function runMigrationsOnStartup(env: Environment): boolean {
  if (env.RUNTIME === "in-memory") {
    return true;
  }
  return localRunMigrationsOnStartup(env);
}

async function buildProcessApiRuntime(env: Environment): Promise<ApiRuntime> {
  return env.RUNTIME === "in-memory"
    ? buildInMemoryApiRuntime(env)
    : buildLocalApiRuntime(env);
}

const runtimeRegistry = createRuntimeRegistry<Environment, ApiRuntime>({
  buildRuntime: buildProcessApiRuntime,
  closeRuntime: runtime => runtime.close(),
  cacheKey: env => [
    env.RUNTIME,
    env.DATABASE_URL,
    env.AUTH_DATABASE_PATH,
    runMigrationsOnStartup(env),
  ].join(":"),
  workerErrorMessage: "getApiRuntime() must not be used on the worker runtime; use resolveApiRuntime(c) per request.",
});

/** Returns the shared API runtime for in-memory and local profiles. */
export const getApiRuntime = runtimeRegistry.get;

function removeDefaultAuthDatabaseFile(): void {
  try {
    unlinkSync(DEFAULT_AUTH_DATABASE_PATH);
  }
  catch {
    // Ignore missing file or active handles.
  }
}

/** Closes cached runtimes and clears the registry (test teardown). */
export async function resetApiRuntimesForTests(): Promise<void> {
  await runtimeRegistry.reset();
  removeDefaultAuthDatabaseFile();
}
