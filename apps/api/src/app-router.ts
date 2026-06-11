import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";
import { authRouteHandler, getAuthRoute, postAuthRoute } from "@/routes/auth.route";
import { getEffectiveGrantsHandler, getEffectiveGrantsRoute } from "@/routes/effective-grants.route";
import { createRouter } from "@/lib/http/create-app";
import { systemCommandHandler, systemCommandRoute } from "@/routes/system.routes";
import { buildCommandRoutes } from "@/routes/commands.routes";
import { buildEntityRoutes } from "@/routes/entities.routes";
import { buildQueryRoutes } from "@/routes/queries.routes";

const router = createRouter()
  .openapi(
    createRoute({
      tags: ["Index"],
      method: "get",
      path: "/",
      responses: {
        [HttpStatusCodes.OK]: jsonContent(
          createMessageObjectSchema(),
          "Edaya Core API Index",
        ),
      },
    }),
    async (c) => {
      return c.json({
        message: "Edaya Core API",
      }, HttpStatusCodes.OK);
    },
  );

router
  .openapi(getAuthRoute, authRouteHandler)
  .openapi(postAuthRoute, authRouteHandler)
  .openapi(getEffectiveGrantsRoute, getEffectiveGrantsHandler)
  .openapi(systemCommandRoute, systemCommandHandler);

[...buildCommandRoutes(), ...buildQueryRoutes(), ...buildEntityRoutes()]
  .forEach(({ route, handler }) => {
    router.openapi(route, handler);
  });

export default router;
