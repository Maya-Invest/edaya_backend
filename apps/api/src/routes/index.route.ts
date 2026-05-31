import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";
import { createRouter } from "@/lib/create-app";
import { authRoutePairs } from "./auth/auth.route";
import { commandRoutePairs } from "./commands/commands.route";
import { queryRoutePairs } from "./queries/queries.route";
import { overdueFeeCountHandler, overdueFeeCountRoute } from "./queries/overdue-fee-count.route";
import { publishedReportCardCountHandler, publishedReportCardCountRoute } from "./queries/published-report-card-count.route";

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

// Programmatically mount all OpenAPI query route and handler pairs
queryRoutePairs.forEach(({ route, handler }) => {
  router.openapi(route, handler);
});
commandRoutePairs.forEach(({ route, handler }) => {
  router.openapi(route, handler);
});
authRoutePairs.forEach(({ route, handler }) => {
  router.openapi(route, handler);
});
router.openapi(overdueFeeCountRoute, overdueFeeCountHandler);
router.openapi(publishedReportCardCountRoute, publishedReportCardCountHandler);

export default router;
