import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";
import { createRouter } from "@/lib/create-app";
import { authRouteHandler, getAuthRoute, postAuthRoute } from "./auth/auth.route";
import { coreRoutePairs } from "./core/core.route";

const router = createRouter()
  .openapi(
    createRoute({
      tags: ["Index"],
      method: "get",
      path: "/",
      responses: {
        [HttpStatusCodes.OK]: jsonContent(
          createMessageObjectSchema(),
          "Maya School Core API Index",
        ),
      },
    }),
    async (c) => {
      return c.json({
        message: "Maya School Core API",
      }, HttpStatusCodes.OK);
    },
  );

router
  .openapi(getAuthRoute, authRouteHandler)
  .openapi(postAuthRoute, authRouteHandler);

// Programmatically mount the core-aligned API surface.
coreRoutePairs.forEach(({ route, handler }) => {
  router.openapi(route, handler);
});

export default router;
