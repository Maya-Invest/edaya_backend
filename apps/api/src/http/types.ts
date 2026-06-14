import type { OpenAPIHono, RouteConfig, RouteHandler } from "@hono/zod-openapi";

import type { AppBindings } from "@/context/bindings";

export type { AppBindings } from "@/context/bindings";

export type AppOpenAPI = OpenAPIHono<AppBindings>;

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, AppBindings>;
