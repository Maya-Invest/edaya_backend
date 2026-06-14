import { unlinkSync } from "node:fs";
import { createRuntimeRegistry } from "@/lib/runtime/process-registry";
import { buildNodeApiRuntime } from "@/lib/runtime/create-runtime-node";
import type { Environment } from "@/lib/runtime/env";
import type { ApiRuntime } from "@/lib/runtime/types";

const DEFAULT_AUTH_DATABASE_PATH = ".data/auth.sqlite";

const runtimeRegistry = createRuntimeRegistry<Environment, ApiRuntime>({
  buildRuntime: buildNodeApiRuntime,
  closeRuntime: runtime => runtime.close(),
  workerErrorMessage: "getApiRuntime() must not be used on the worker runtime; use resolveApiRuntime(c) per request.",
});

/**
 * Returns the shared API runtime for the given env (database + auth + school app).
 * Always use this entry point — do not call `buildNodeApiRuntime` directly or you
 * risk creating a second database handle that middleware will not see.
 */
export const getApiRuntime = runtimeRegistry.get;

function removeDefaultAuthDatabaseFile(): void {
  try {
    unlinkSync(DEFAULT_AUTH_DATABASE_PATH);
  }
  catch {
    // Ignore missing file or active handles; the next runtime opens a fresh database.
  }
}

/**
 * Closes cached runtimes and clears the registry. Use in test teardown so
 * ephemeral PGlite instances do not keep the Bun test runner alive (exit 99).
 */
export async function resetApiRuntimesForTests(): Promise<void> {
  await runtimeRegistry.reset();
  removeDefaultAuthDatabaseFile();
}
