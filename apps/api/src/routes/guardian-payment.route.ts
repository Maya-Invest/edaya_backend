import type { AppRouteHandler } from "@/http/types";
import { guardianFeesQuery, guardianFeesSummary, guardianPaymentDetail, guardianPaymentQuery, guardianSettlementPage, guardianSettlementQuery } from "@edaya/core";
import { createRoute } from "@hono/zod-openapi";
import { jsonContent } from "stoker/openapi/helpers";
import { routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import { queryRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";

export const paymentQuery = guardianPaymentQuery.openapi("GuardianPaymentQuery");
const response = guardianPaymentDetail.openapi("GuardianPaymentDetail");
export const guardianPaymentRoute = createRoute({
  method: "get",
  path: "/core/guardian/payment",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getGuardianPaymentDetail", publicName: "guardian-payment-detail", requestSchema: paymentQuery, responseSchema: response }),
  request: { query: paymentQuery },
  responses: { 200: jsonContent(response, "Selected payment for this pupil and year with its charge labels"), ...coreRouteErrorResponses },
});

export const guardianPaymentHandler: AppRouteHandler<typeof guardianPaymentRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    return c.json(await c.get("schoolApp").forActor(actor).getGuardianPaymentDetail(c.req.valid("query")), 200);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};

export const feesQuery = guardianFeesQuery.openapi("GuardianFeesQuery");
const feesQueryResponse = guardianFeesSummary.openapi("GuardianFeesSummary");
export const guardianFeesRoute = createRoute({
  method: "get",
  path: "/core/guardian/fees/summary",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getGuardianFeesSummary", publicName: "guardian-fees-summary", requestSchema: feesQuery, responseSchema: feesQueryResponse }),
  request: { query: feesQuery },
  responses: { 200: jsonContent(feesQueryResponse, "Selected pupil balance and complete charge totals"), ...coreRouteErrorResponses },
});

export const guardianFeesHandler: AppRouteHandler<typeof guardianFeesRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    return c.json(await c.get("schoolApp").forActor(actor).getGuardianFeesSummary(c.req.valid("query")), 200);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};

export const settlementsQuery = guardianSettlementQuery.openapi("GuardianSettlementsQuery");
const settlementsQueryResponse = guardianSettlementPage.openapi("GuardianSettlementPage");
export const guardianSettlementsRoute = createRoute({
  method: "get",
  path: "/core/guardian/settlements",
  tags: ["Core Queries"],
  ...queryRouteOperation({ methodName: "getGuardianSettlements", publicName: "guardian-settlements", requestSchema: settlementsQuery, responseSchema: settlementsQueryResponse }),
  request: { query: settlementsQuery },
  responses: { 200: jsonContent(settlementsQueryResponse, "Paged charges and payments for the selected pupil and year"), ...coreRouteErrorResponses },
});

export const guardianSettlementsHandler: AppRouteHandler<typeof guardianSettlementsRoute> = async (c) => {
  c.header("Cache-Control", "private, no-store");
  const actor = c.get("actor");
  if (!actor)
    return unauthorizedResponse(c);
  try {
    return c.json(await c.get("schoolApp").forActor(actor).getGuardianSettlements(c.req.valid("query")), 200);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};
