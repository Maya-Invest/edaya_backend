import { Permission } from "@edaya/core";
import { listPermissionCatalog, renderScopeIds } from "@edaya/authorization";
import type { ScopeType } from "@edaya/authorization";
import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";
import type { AppRouteHandler } from "@/http/types";
import { getErrorMessage, unauthorizedResponse } from "@/http/responses";
import { requireInteractiveActor } from "@/lib/authorization/serialize-grants";
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
    [HttpStatusCodes.OK]: jsonContent(permissionCatalogResponseSchema, "Permission catalog"),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(commandMessageSchema, "Missing or invalid authorization session"),
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
  permission: z.nativeEnum(Permission).optional(),
  scopeIds: z.string(),
});

const scopeRenderSegmentSchema = z.object({
  id: z.string(),
  scope: z.enum([
    "grade_level",
    "grade_level_subject",
    "class_group",
    "class_subject",
    "activity",
    "student",
    "platform",
  ]),
  label: z.string(),
  missing: z.boolean().optional(),
});

const scopeRenderClauseSchema = z.object({
  raw: z.string(),
  label: z.string(),
  wildcard: z.boolean(),
  segments: z.array(scopeRenderSegmentSchema),
});

const scopeRenderItemResponseSchema = z.object({
  scopeIds: z.string(),
  permission: z.nativeEnum(Permission).optional(),
  tenantWide: z.boolean(),
  clauses: z.array(scopeRenderClauseSchema),
});

const scopeRenderRequestSchema = z.object({
  academicYearId: z.string().optional(),
  items: z.array(scopeRenderItemRequestSchema).min(1),
}).openapi("ScopeRenderRequest");

const scopeRenderResponseSchema = z.object({
  items: z.array(scopeRenderItemResponseSchema),
}).openapi("ScopeRenderResponse");

export const postScopeRenderRoute = createRoute({
  method: "post",
  path: schoolApiPath("authorization", "scope", "render"),
  tags: ["Core Authorization"],
  summary: "Render scopeIds strings for admin UI display",
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
    [HttpStatusCodes.OK]: jsonContent(scopeRenderResponseSchema, "Rendered scope labels"),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(commandMessageSchema, "Missing or invalid authorization session"),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(commandMessageSchema, "Internal server error occurred"),
  },
});

export const postScopeRenderHandler: AppRouteHandler<typeof postScopeRenderRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const interactiveActor = requireInteractiveActor(actor);
  if (!interactiveActor) {
    return unauthorizedResponse(c);
  }

  const body = c.req.valid("json");
  const service = c.get("schoolApp").forActor(interactiveActor);
  const repositories = service.baseService.repositories;

  try {
    const items = await Promise.all(body.items.map(async (item) => {
      return renderScopeIds(item.scopeIds, {
        permission: item.permission,
        resolveLabel: async (scope: ScopeType, entityId: string) => {
          switch (scope) {
            case "class_group": {
              const entity = await repositories.classGroups.findById(entityId);
              return entity?.name;
            }
            case "class_subject": {
              const classSubject = await repositories.classSubjects.findById(entityId);
              if (!classSubject) {
                return undefined;
              }
              const subject = await repositories.subjects.findById(classSubject.subjectId);
              return subject?.name;
            }
            case "grade_level": {
              const entity = await repositories.gradeLevels.findById(entityId);
              return entity?.name;
            }
            case "grade_level_subject": {
              const gradeLevelSubject = await repositories.gradeLevelSubjects.findById(entityId);
              if (!gradeLevelSubject) {
                return undefined;
              }
              const subject = await repositories.subjects.findById(gradeLevelSubject.subjectId);
              return subject?.name;
            }
            case "activity": {
              const entity = await repositories.activities.findById(entityId);
              return entity?.name;
            }
            case "student": {
              const entity = await repositories.students.findById(entityId);
              return entity ? `${entity.firstName} ${entity.lastName}` : undefined;
            }
            default:
              return undefined;
          }
        },
      });
    }));

    return c.json({
      items: items.map(item => ({
        scopeIds: item.scopeIds,
        ...(item.permission ? { permission: item.permission } : {}),
        tenantWide: item.tenantWide,
        clauses: item.clauses.map(clause => ({
          raw: clause.raw,
          label: clause.label,
          wildcard: clause.wildcard,
          segments: clause.segments.map(segment => ({
            id: segment.id,
            scope: segment.scope,
            label: segment.label,
            ...(segment.missing ? { missing: true } : {}),
          })),
        })),
      })),
    }, HttpStatusCodes.OK);
  }
  catch (err) {
    return c.json({ message: getErrorMessage(err) }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};
