import type { AppBindings } from "@/lib/types";
import type { Context, MiddlewareHandler } from "hono";
import { sessionActorDependency } from "./dependencies/actor";
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
  sessionActorDependency,
]);
