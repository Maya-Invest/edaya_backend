import type { Environment } from "@/lib/bootstrap/env";
import { buildApiRuntime } from "@/lib/runtime/create-runtime";
import type { ApiRuntime } from "@/lib/runtime/types";

const runtimes = new Map<string, Promise<ApiRuntime>>();

/**
 * Returns the shared API runtime for the given env (database + auth + school app).
 * Always use this entry point — do not call `buildApiRuntime` directly or you
 * risk creating a second database handle that middleware will not see.
 */
export async function getApiRuntime(env: Environment): Promise<ApiRuntime> {
  const cacheKey = `${env.RUNTIME}:${env.DATABASE_URL}`;
  let pending = runtimes.get(cacheKey);
  if (!pending) {
    pending = buildApiRuntime(env);
    runtimes.set(cacheKey, pending);
  }
  return pending;
}

/**
 * Resets the API runtimes for tests.
 */
export function resetApiRuntimesForTests(): void {
  runtimes.clear();
}
