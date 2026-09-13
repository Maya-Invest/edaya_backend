import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";
import { grantScopeSchema, grantScopesSchema, Permission } from "@edaya/core";
import { AccessFacts, listPermissionCatalog, renderGrantScopes } from "@edaya/authorization";
import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";
import type { AppRouteHandler } from "@/http/types";
import { getErrorMessage, routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import { requireInteractiveActor, requireSchoolInteractiveActor } from "@/lib/authorization/serialize-grants";
import { clientRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { schoolApiPath } from "@/lib/school-api/routes/paths";

const commandMessageSchema = createMessageObjectSchema();

const permissionCatalogEntrySchema = z.object({
  permission: z.nativeEnum(Permission),
  scope: z.enum([
    "grade_level",
    "grade_level_subject",
    "class_group",
    "class_subject",
    "activity",
    "student",
    "platform",
  ]).optional(),
}).openapi("PermissionCatalogEntry");

const permissionCatalogResponseSchema = z.object({
  items: z.array(permissionCatalogEntrySchema),
}).openapi("PermissionCatalogResponse");

export const getPermissionCatalogRoute = createRoute({
  method: "get",
  path: schoolApiPath("authorization", "permission-catalog"),
  tags: ["Core Authorization"],
  summary: "Permission catalog for access-control UI",
  ...clientRouteOperation({
    namespace: "authorization",
    clientKey: "permissionCatalog",
    path: "authorization/permission-catalog",
    responseSchemaName: "PermissionCatalogResponse",
  }),
  responses: {
    ...coreRouteErrorResponses,
    [HttpStatusCodes.OK]: jsonContent(permissionCatalogResponseSchema, "Permission catalog"),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(commandMessageSchema, "Missing or invalid authorization session"),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(commandMessageSchema, "Access denied"),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(commandMessageSchema, "Invalid request"),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(commandMessageSchema, "Internal server error occurred"),
  },
});

export const getPermissionCatalogHandler: AppRouteHandler<typeof getPermissionCatalogRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  if (!requireInteractiveActor(actor)) {
    return unauthorizedResponse(c);
  }

  try {
    const items = listPermissionCatalog().map(entry => ({
      permission: entry.permission,
      ...(entry.scope ? { scope: entry.scope } : {}),
    }));
    return c.json({ items }, HttpStatusCodes.OK);
  }
  catch (err) {
    return c.json({ message: getErrorMessage(err) }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

const scopeRenderItemRequestSchema = z.object({
  permission: z.nativeEnum(Permission),
  scopes: grantScopesSchema,
});

const scopeRenderRequestSchema = z.object({
  academicYearId: z.string().trim().min(1),
  items: z.array(scopeRenderItemRequestSchema).min(1).max(100),
}).openapi("ScopeRenderRequest");

const scopeRenderResponseSchema = z.object({
  items: z.array(z.object({
    permission: z.nativeEnum(Permission),
    scopes: z.array(z.object({ scope: grantScopeSchema, label: z.string(), missing: z.boolean() })),
  })),
}).openapi("ScopeRenderResponse");

export const postScopeRenderRoute = createRoute({
  method: "post",
  path: schoolApiPath("authorization", "scope", "render"),
  tags: ["Core Authorization"],
  summary: "Label typed permission scopes for the access-control UI",
  request: {
    body: jsonContent(scopeRenderRequestSchema, "Scope render batch"),
  },
  ...clientRouteOperation({
    namespace: "authorization",
    clientKey: "scopeRender",
    path: "authorization/scope/render",
    requestSchemaName: "ScopeRenderRequest",
    responseSchemaName: "ScopeRenderResponse",
  }),
  responses: {
    ...coreRouteErrorResponses,
    [HttpStatusCodes.OK]: jsonContent(scopeRenderResponseSchema, "Rendered scope labels"),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(commandMessageSchema, "Missing or invalid authorization session"),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(commandMessageSchema, "Access denied"),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(commandMessageSchema, "Invalid request"),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(commandMessageSchema, "Internal server error occurred"),
  },
});

export const postScopeRenderHandler: AppRouteHandler<typeof postScopeRenderRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const interactiveActor = requireSchoolInteractiveActor(actor);
  if (!interactiveActor) {
    return unauthorizedResponse(c);
  }

  const body = c.req.valid("json");
  const service = c.get("schoolApp").forActor(interactiveActor);
  try {
    await service.baseService.access.staffPermissions.assertRead();
    const facts = new AccessFacts(interactiveActor, service.baseService.repositories);
    const items = await Promise.all(body.items.map(async item => ({
      permission: item.permission,
      scopes: await renderGrantScopes(facts, { ...item, academicYearId: body.academicYearId }),
    })));
    return c.json({ items }, HttpStatusCodes.OK);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};
