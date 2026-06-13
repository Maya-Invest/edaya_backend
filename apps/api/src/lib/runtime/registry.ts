import { createRuntimeRegistry } from "@edaya/adaptor-cloudflare";
import { buildApiRuntime } from "@/lib/runtime/create-runtime";
import type { Environment } from "@/lib/runtime/env";
import type { ApiRuntime } from "@/lib/runtime/types";

const runtimeRegistry = createRuntimeRegistry<Environment, ApiRuntime>({
  buildRuntime: buildApiRuntime,
  closeRuntime: runtime => runtime.close(),
  workerErrorMessage: "getApiRuntime() must not be used on the worker runtime; use resolveApiRuntime(c) per request.",
});

/**
 * Returns the shared API runtime for the given env (database + auth + school app).
 * Always use this entry point — do not call `buildApiRuntime` directly or you
 * risk creating a second database handle that middleware will not see.
 */
export const getApiRuntime = runtimeRegistry.get;

/**
 * Closes cached runtimes and clears the registry. Use in test teardown so
 * ephemeral PGlite instances do not keep the Bun test runner alive (exit 99).
 */
export const resetApiRuntimesForTests = runtimeRegistry.reset;
