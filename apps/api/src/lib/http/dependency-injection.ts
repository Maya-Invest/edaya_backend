import type { Context, Env, MiddlewareHandler } from "hono";

export interface DependencyModule<E extends Env = Env> {
  name: string;
  resolve: (c: Context<E>) => Promise<void> | void;
}

export interface DependenciesInjectionOptions<E extends Env> {
  onRequestComplete?: (c: Context<E>) => Promise<void> | void;
}

export function createDependenciesInjection<E extends Env>(
  dependencies: readonly DependencyModule<E>[],
  options: DependenciesInjectionOptions<E> = {},
): MiddlewareHandler<E> {
  return async (c, next) => {
    for (const dependency of dependencies) {
      await dependency.resolve(c);
    }

    try {
      await next();
    }
    finally {
      await options.onRequestComplete?.(c);
    }
  };
}
