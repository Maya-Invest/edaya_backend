import type { AppRouteHandler } from "@/lib/http/types";
import { toBetterAuthHandlerRequest } from "@/lib/http/auth-request";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";

function createAuthProxyRoute(method: "get" | "post") {
  return createRoute({
    method,
    path: "/api/auth/*",
    tags: ["Auth"],
    summary: `Better Auth ${method.toUpperCase()} proxy`,
    description: "Delegates Better Auth requests to the configured Better Auth handler.",
    responses: {
      [HttpStatusCodes.OK]: {
        description: "Better Auth response",
      },
      [HttpStatusCodes.BAD_REQUEST]: {
        description: "Invalid Better Auth request",
      },
      [HttpStatusCodes.UNAUTHORIZED]: {
        description: "Unauthorized Better Auth request",
      },
    },
  });
}

const getAuthRoute = createAuthProxyRoute("get");
const postAuthRoute = createAuthProxyRoute("post");

const authRouteHandler: AppRouteHandler<typeof getAuthRoute> = async (c) => {
  return c.var.auth.handler(toBetterAuthHandlerRequest(c));
};

export { authRouteHandler, getAuthRoute, postAuthRoute };
