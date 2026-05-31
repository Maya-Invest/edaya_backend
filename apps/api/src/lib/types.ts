import type { OpenAPIHono, RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { PinoLogger } from "hono-pino";

import type { Environment } from "@/env";
import type { ActorMetadata, SchoolApplication } from "@edaya/core";

export interface AppBindings {
  Bindings: Environment;
  Variables: {
    logger: PinoLogger;
    schoolApp: SchoolApplication;
    actor: ActorMetadata | null;
  };
};

export type AppOpenAPI = OpenAPIHono<AppBindings>;

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, AppBindings>;
