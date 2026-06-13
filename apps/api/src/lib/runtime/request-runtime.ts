import type { Context, Env } from "hono";
import type { RuntimeKind } from "@/lib/runtime/host-types";

export interface RequestRuntimeStore<E extends Env, TRuntime> {
  get: (c: Context<E>) => TRuntime | undefined;
  set: (c: Context<E>, runtime: TRuntime | undefined) => void;
}

export interface WorkerRequestRuntimeResolver<
  TEnv extends { RUNTIME: RuntimeKind },
  TRuntime,
  E extends Env & { Bindings: TEnv },
> {
  isWorkerRuntime: (env: TEnv) => boolean;
  resolve: (c: Context<E>) => Promise<TRuntime>;
  close: (c: Context<E>) => Promise<void>;
}

export function createWorkerRequestRuntimeResolver<
  TEnv extends { RUNTIME: RuntimeKind },
  TRuntime,
  E extends Env & { Bindings: TEnv },
>(
  store: RequestRuntimeStore<E, TRuntime>,
  buildRuntime: (env: TEnv) => Promise<TRuntime>,
  closeRuntime: (runtime: TRuntime) => Promise<void>,
): WorkerRequestRuntimeResolver<TEnv, TRuntime, E> {
  const isWorkerRuntime = (env: TEnv) => env.RUNTIME === "worker";

  return {
    isWorkerRuntime,
    async resolve(c) {
      if (!isWorkerRuntime(c.env)) {
        throw new Error("resolve() is only for the worker runtime; use a shared registry on node.");
      }

      const existing = store.get(c);
      if (existing) {
        return existing;
      }

      const runtime = await buildRuntime(c.env);
      store.set(c, runtime);
      return runtime;
    },
    async close(c) {
      const env = c.env as TEnv | undefined;
      if (!env || !isWorkerRuntime(env)) {
        return;
      }

      const runtime = store.get(c);
      if (!runtime) {
        return;
      }

      await closeRuntime(runtime);
      store.set(c, undefined);
    },
  };
}
