import type { RuntimeKind } from "./types";

export interface RuntimeRegistry<TEnv extends { RUNTIME: RuntimeKind; DATABASE_URL: string }, TRuntime> {
  get: (env: TEnv) => Promise<TRuntime>;
  reset: () => Promise<void>;
}

export interface RuntimeRegistryOptions<TEnv extends { RUNTIME: RuntimeKind; DATABASE_URL: string }, TRuntime> {
  buildRuntime: (env: TEnv) => Promise<TRuntime>;
  closeRuntime: (runtime: TRuntime) => Promise<void>;
  cacheKey?: (env: TEnv) => string;
  workerErrorMessage?: string;
}

export function createRuntimeRegistry<
  TEnv extends { RUNTIME: RuntimeKind; DATABASE_URL: string },
  TRuntime,
>(
  options: RuntimeRegistryOptions<TEnv, TRuntime>,
): RuntimeRegistry<TEnv, TRuntime> {
  const runtimes = new Map<string, Promise<TRuntime>>();
  const cacheKey = options.cacheKey ?? (env => `${env.RUNTIME}:${env.DATABASE_URL}`);
  const workerErrorMessage = options.workerErrorMessage
    ?? "get() must not be used on the worker runtime; resolve per request instead.";

  return {
    async get(env) {
      if (env.RUNTIME === "worker") {
        throw new Error(workerErrorMessage);
      }

      const key = cacheKey(env);
      let pending = runtimes.get(key);
      if (!pending) {
        pending = options.buildRuntime(env);
        runtimes.set(key, pending);
      }
      return pending;
    },
    async reset() {
      const pending = [...runtimes.values()];
      runtimes.clear();

      await Promise.all(
        pending.map(async (runtimePromise) => {
          try {
            const runtime = await runtimePromise;
            await options.closeRuntime(runtime);
          }
          catch {
            // Ignore teardown errors in tests.
          }
        }),
      );
    },
  };
}
