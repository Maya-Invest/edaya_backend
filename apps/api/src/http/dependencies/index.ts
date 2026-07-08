import {
  createDependenciesInjection as createHonoDependenciesInjection,

} from "@/http/dependency-injection";
import type { DependencyModule } from "@/http/dependency-injection";
import type { MiddlewareHandler } from "hono";
import { closeRequestApiRuntime } from "@/runtime/resolve-api-runtime";
import type { AppBindings } from "@/http/types";
import { authDependency } from "./auth";
import { sessionActorDependency } from "./session-actor";
import { schoolAppDependency } from "./school-app";

export type { DependencyModule };

export function createDependenciesInjection(
  dependencies: readonly DependencyModule<AppBindings>[],
): MiddlewareHandler<AppBindings> {
  return createHonoDependenciesInjection(dependencies, {
    onRequestComplete: closeRequestApiRuntime,
  });
}

export const dependenciesInjection = createDependenciesInjection([
  schoolAppDependency,
  authDependency,
  sessionActorDependency,
]);
