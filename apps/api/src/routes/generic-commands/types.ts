import type { AppRouteHandler } from "@/lib/types";
import type { RouteConfig } from "@hono/zod-openapi";

export interface CommandRoutePair<R extends RouteConfig = any> {
  route: R;
  handler: AppRouteHandler<R>;
}
