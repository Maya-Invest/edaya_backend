import { toBetterAuthHandlerRequest } from "@/lib/http/auth-request";
import { createRouter } from "@/lib/http/create-app";
import type { AppBindings } from "@/lib/http/types";
import { getEffectiveGrantsHandler, getEffectiveGrantsRoute } from "@/routes/effective-grants.route";
import {
  listPrototypeActivitiesHandler,
  listPrototypeActivitiesRoute,
  listPrototypeDeadlinesHandler,
  listPrototypeDeadlinesRoute,
  listPrototypeDemoAccountsHandler,
  listPrototypeDemoAccountsRoute,
  listPrototypeTeachingLogHandler,
  listPrototypeTeachingLogRoute,
} from "@/routes/prototype.routes";
import { systemCommandHandler, systemCommandRoute } from "@/routes/system.routes";
import { createRoute } from "@hono/zod-openapi";
import type { Context } from "hono";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";
import { buildCoreRoutes } from "@/lib/school-api/routes";

// Index route
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

// Mount routes from route builders
router
  .openapi(getEffectiveGrantsRoute, getEffectiveGrantsHandler)
  .openapi(listPrototypeActivitiesRoute, listPrototypeActivitiesHandler)
  .openapi(listPrototypeDeadlinesRoute, listPrototypeDeadlinesHandler)
  .openapi(listPrototypeDemoAccountsRoute, listPrototypeDemoAccountsHandler)
  .openapi(listPrototypeTeachingLogRoute, listPrototypeTeachingLogHandler)
  .openapi(systemCommandRoute, systemCommandHandler);

// Mount routes from route factories
[...buildCoreRoutes()]
  .forEach(({ route, handler }) => {
    router.openapi(route, handler);
  });

// Mount auth routes
router
  .on(["GET", "POST"], "/auth/*", (c: Context<AppBindings>) => c.var.auth.handler(toBetterAuthHandlerRequest(c)));

export default router;
