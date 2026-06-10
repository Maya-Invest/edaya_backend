import type { AppBindings } from "@/lib/http/types";
import type { Context, MiddlewareHandler } from "hono";
import { authDependency } from "./dependencies/auth";
import { sessionActorDependency } from "./dependencies/session-actor";
import { envDependency } from "./dependencies/env";
import { createSchoolAppDependency } from "./dependencies/school-app";

export interface DependencyModule {
  name: string;
  resolve: (c: Context<AppBindings>) => Promise<void> | void;
}

export function createDependenciesInjection(dependencies: readonly DependencyModule[]): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    for (const dependency of dependencies) {
      await dependency.resolve(c);
    }

    await next();
  };
}

export const dependenciesInjection = createDependenciesInjection([
  envDependency,
  createSchoolAppDependency(),
  authDependency,
  sessionActorDependency,
]);
