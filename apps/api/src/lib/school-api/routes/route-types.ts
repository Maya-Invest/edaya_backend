import type { AppRouteHandler } from "@/lib/http/types";
import type { RouteConfig } from "@hono/zod-openapi";

export interface SchoolApiRoutePair<R extends RouteConfig = any> {
  route: R;
  handler: AppRouteHandler<R>;
}
