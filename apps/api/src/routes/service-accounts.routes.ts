import type { AppRouteHandler } from "@/http/types";
import { routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import {
  createServiceAccountRequestSchema,
  createServiceAccountResponseSchema,
  rotateServiceAccountKeyRequestSchema,
  rotateServiceAccountKeyResponseSchema,
  serializeServiceAccount,
  serviceAccountResponseSchema,
  updateServiceAccountRequestSchema,
} from "@/lib/service-accounts/schemas";
import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";
import { clientRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { schoolApiPath } from "@/lib/school-api/routes/paths";
import { createServiceAccount, listServiceAccounts, revokeServiceAccount, rotateServiceAccountKey, updateServiceAccount } from "@edaya/authorization";
import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

export const createServiceAccountRoute = createRoute({
  method: "post",
  path: schoolApiPath("service-accounts"),
  tags: ["Core Service Accounts"],
  summary: "Create a school service account and return its API key once",
  ...clientRouteOperation({
    namespace: "serviceAccounts",
    clientKey: "create",
    path: "service-accounts",
    requestSchemaName: "CreateServiceAccountRequest",
    responseSchemaName: "CreateServiceAccountResponse",
  }),
  request: {
    body: jsonContent(createServiceAccountRequestSchema, "Service account provisioning payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(createServiceAccountResponseSchema, "Created service account"),
    ...coreRouteErrorResponses,
  },
});

export const listServiceAccountsRoute = createRoute({
  method: "get",
  path: schoolApiPath("service-accounts"),
  tags: ["Core Service Accounts"],
  summary: "List service accounts for the current school",
  ...clientRouteOperation({
    namespace: "serviceAccounts",
    clientKey: "list",
    path: "service-accounts",
    responseSchemaName: "ServiceAccountResponse",
    responseIsArray: true,
  }),
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.array(serviceAccountResponseSchema), "Service accounts"),
    ...coreRouteErrorResponses,
  },
});

export const updateServiceAccountRoute = createRoute({
  method: "patch",
  path: schoolApiPath("service-accounts", "{id}"),
  tags: ["Core Service Accounts"],
  summary: "Update a service account display name, roles, or scope grants",
  ...clientRouteOperation({
    namespace: "serviceAccounts",
    clientKey: "update",
    path: "service-accounts/{id}",
    pathParams: ["id"],
    requestSchemaName: "UpdateServiceAccountRequest",
    responseSchemaName: "ServiceAccountResponse",
  }),
  request: {
    params: z.object({ id: z.string().trim().min(1) }),
    body: jsonContent(updateServiceAccountRequestSchema, "Service account update payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(serviceAccountResponseSchema, "Updated service account"),
    ...coreRouteErrorResponses,
  },
});

export const revokeServiceAccountRoute = createRoute({
  method: "post",
  path: schoolApiPath("service-accounts", "{id}", "revoke"),
  tags: ["Core Service Accounts"],
  summary: "Revoke a service account and invalidate its API keys",
  ...clientRouteOperation({
    namespace: "serviceAccounts",
    clientKey: "revoke",
    path: "service-accounts/{id}/revoke",
    pathParams: ["id"],
    responseSchemaName: "ServiceAccountResponse",
  }),
  request: {
    params: z.object({ id: z.string().trim().min(1) }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(serviceAccountResponseSchema, "Revoked service account"),
    ...coreRouteErrorResponses,
  },
});

export const rotateServiceAccountKeyRoute = createRoute({
  method: "post",
  path: schoolApiPath("service-accounts", "{id}", "rotate-key"),
  tags: ["Core Service Accounts"],
  summary: "Rotate the API key for a service account",
  ...clientRouteOperation({
    namespace: "serviceAccounts",
    clientKey: "rotateKey",
    path: "service-accounts/{id}/rotate-key",
    pathParams: ["id"],
    responseSchemaName: "RotateServiceAccountKeyResponse",
  }),
  request: {
    params: z.object({ id: z.string().trim().min(1) }),
    body: jsonContent(rotateServiceAccountKeyRequestSchema, "Optional fixed API key for dev seeding"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(rotateServiceAccountKeyResponseSchema, "Rotated API key"),
    ...coreRouteErrorResponses,
  },
});

export const createServiceAccountHandler: AppRouteHandler<typeof createServiceAccountRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor || actor.kind !== "staff") {
    return unauthorizedResponse(c);
  }

  try {
    const body = c.req.valid("json");
    const result = await createServiceAccount(c.get("schoolApp").repositories, actor, {
      serviceId: body.serviceId,
      displayName: body.displayName,
      ...(body.permissionAssignments ? { permissionAssignments: body.permissionAssignments } : {}),
      ...(body.elevated !== undefined ? { elevated: body.elevated } : {}),
      ...(body.apiKey ? { apiKey: body.apiKey } : {}),
    });

    return c.json({
      ...serializeServiceAccount(result.staffMember),
      apiKey: result.apiKey,
    }, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};

export const listServiceAccountsHandler: AppRouteHandler<typeof listServiceAccountsRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor || actor.kind !== "staff") {
    return unauthorizedResponse(c);
  }

  try {
    const accounts = await listServiceAccounts(c.get("schoolApp").repositories, actor);
    return c.json(accounts.map(serializeServiceAccount), HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};

export const updateServiceAccountHandler: AppRouteHandler<typeof updateServiceAccountRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor || actor.kind !== "staff") {
    return unauthorizedResponse(c);
  }

  try {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const updated = await updateServiceAccount(c.get("schoolApp").repositories, actor, id, {
      ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
      ...(body.permissionAssignments !== undefined ? { permissionAssignments: body.permissionAssignments } : {}),
    });

    return c.json(serializeServiceAccount(updated), HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};

export const revokeServiceAccountHandler: AppRouteHandler<typeof revokeServiceAccountRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor || actor.kind !== "staff") {
    return unauthorizedResponse(c);
  }

  try {
    const { id } = c.req.valid("param");
    const revoked = await revokeServiceAccount(c.get("schoolApp").repositories, actor, id);
    return c.json(serializeServiceAccount(revoked), HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};

export const rotateServiceAccountKeyHandler: AppRouteHandler<typeof rotateServiceAccountKeyRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor || actor.kind !== "staff") {
    return unauthorizedResponse(c);
  }

  try {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await rotateServiceAccountKey(c.get("schoolApp").repositories, actor, id, {
      ...(body.apiKey ? { apiKey: body.apiKey } : {}),
    });
    return c.json(result, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
