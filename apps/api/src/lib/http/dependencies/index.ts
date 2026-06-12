import type { AppBindings } from "@/lib/http/types";
import type { Context, MiddlewareHandler } from "hono";
import { closeRequestApiRuntime } from "@/lib/runtime/resolve-api-runtime";
import { authDependency } from "./auth";
import { sessionActorDependency } from "./session-actor";
import { envDependency } from "./env";
import { createSchoolAppDependency } from "./school-app";

export interface DependencyModule {
  name: string;
  resolve: (c: Context<AppBindings>) => Promise<void> | void;
}

export function createDependenciesInjection(dependencies: readonly DependencyModule[]): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    for (const dependency of dependencies) {
      await dependency.resolve(c);
    }

    try {
      await next();
    }
    finally {
      await closeRequestApiRuntime(c);
    }
  };
}

export const dependenciesInjection = createDependenciesInjection([
  envDependency,
  createSchoolAppDependency(),
  authDependency,
  sessionActorDependency,
]);
