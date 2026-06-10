import type { OpenAPIHono, RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { PinoLogger } from "hono-pino";

import type { Environment } from "@/lib/bootstrap/env";
import type { ApiSchoolApplication } from "@/lib/school-api/runtime/school-application";
import type { ActorMetadata } from "@edaya/core";

export interface AppBindings {
  Bindings: Environment;
  Variables: {
    logger: PinoLogger;
    schoolApp: ApiSchoolApplication;
    actor: ActorMetadata | null;
  };
};

export type AppOpenAPI = OpenAPIHono<AppBindings>;

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, AppBindings>;
