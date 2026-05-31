import type { AppRouteHandler } from "@/lib/types";
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
  const { auth } = await import("@/routes/auth/auth.config");
  return auth.handler(c.req.raw);
};

export { authRouteHandler, getAuthRoute, postAuthRoute };
