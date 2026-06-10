import type { Environment } from "@/lib/bootstrap/env";
import { createApiRuntime } from "@/lib/runtime/create-runtime";
import type { ApiRuntime } from "@/lib/runtime/types";

const runtimes = new Map<string, Promise<ApiRuntime>>();

export async function getApiRuntime(env: Environment): Promise<ApiRuntime> {
  const cacheKey = `${env.RUNTIME}:${env.DATABASE_URL}`;
  let pending = runtimes.get(cacheKey);
  if (!pending) {
    pending = createApiRuntime(env);
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
