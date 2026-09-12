import type { AppRouteHandler } from "@/http/types";
import { routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import {
  createS2sClientRequestSchema,
  createS2sClientResponseSchema,
  rotateS2sClientKeyRequestSchema,
  rotateS2sClientKeyResponseSchema,
  s2sClientResponseSchema,
  serializeS2sClient,
} from "@/lib/platform/schemas";
import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";
import { clientRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { schoolApiPath } from "@/lib/school-api/routes/paths";
import { createS2sClient, listS2sClients, revokeS2sClient, rotateS2sClientKey } from "@edaya/authorization";
import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

export const listS2sClientsRoute = createRoute({
  method: "get",
  path: schoolApiPath("s2s-clients"),
  tags: ["Core Platform"],
  summary: "List school S2S clients",
  ...clientRouteOperation({
    namespace: "s2sClients",
    clientKey: "list",
    path: "s2s-clients",
    responseSchemaName: "S2sClientResponse",
    responseIsArray: true,
  }),
  request: {
    query: z.object({
      schoolId: z.string().trim().min(1).optional(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.array(s2sClientResponseSchema), "S2S clients"),
    ...coreRouteErrorResponses,
  },
});

export const createS2sClientRoute = createRoute({
  method: "post",
  path: schoolApiPath("s2s-clients"),
  tags: ["Core Platform"],
  summary: "Mint a per-school S2S API key and return the plaintext once",
  ...clientRouteOperation({
    namespace: "s2sClients",
    clientKey: "create",
    path: "s2s-clients",
    requestSchemaName: "CreateS2sClientRequest",
    responseSchemaName: "CreateS2sClientResponse",
  }),
  request: {
    body: jsonContent(createS2sClientRequestSchema, "S2S client provisioning payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(createS2sClientResponseSchema, "Created S2S client"),
    ...coreRouteErrorResponses,
  },
});

export const revokeS2sClientRoute = createRoute({
  method: "post",
  path: schoolApiPath("s2s-clients", "{id}", "revoke"),
  tags: ["Core Platform"],
  summary: "Revoke an S2S client key",
  ...clientRouteOperation({
    namespace: "s2sClients",
    clientKey: "revoke",
    path: "s2s-clients/{id}/revoke",
    pathParams: ["id"],
    responseSchemaName: "S2sClientResponse",
  }),
  request: {
    params: z.object({ id: z.string().trim().min(1) }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(s2sClientResponseSchema, "Revoked S2S client"),
    ...coreRouteErrorResponses,
  },
});

export const rotateS2sClientKeyRoute = createRoute({
  method: "post",
  path: schoolApiPath("s2s-clients", "{id}", "rotate-key"),
  tags: ["Core Platform"],
  summary: "Rotate the API key for an S2S client",
  ...clientRouteOperation({
    namespace: "s2sClients",
    clientKey: "rotateKey",
    path: "s2s-clients/{id}/rotate-key",
    pathParams: ["id"],
    requestSchemaName: "RotateS2sClientKeyRequest",
    responseSchemaName: "RotateS2sClientKeyResponse",
  }),
  request: {
    params: z.object({ id: z.string().trim().min(1) }),
    body: jsonContent(rotateS2sClientKeyRequestSchema, "Optional fixed API key for tests"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(rotateS2sClientKeyResponseSchema, "Rotated API key"),
    ...coreRouteErrorResponses,
  },
});

export const listS2sClientsHandler: AppRouteHandler<typeof listS2sClientsRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor || actor.kind !== "platform") {
    return unauthorizedResponse(c);
  }

  try {
    const { schoolId } = c.req.valid("query");
    const clients = await listS2sClients(
      c.get("schoolApp").repositories.s2sClients,
      actor,
      schoolId,
    );
    return c.json(clients.map(client => serializeS2sClient(client)), HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};

export const createS2sClientHandler: AppRouteHandler<typeof createS2sClientRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor || actor.kind !== "platform") {
    return unauthorizedResponse(c);
  }

  try {
    const body = c.req.valid("json");
    const result = await createS2sClient(c.get("schoolApp").repositories.s2sClients, actor, {
      schoolId: body.schoolId,
      clientId: body.clientId,
      accessClass: body.accessClass,
      ...(body.apiKey ? { apiKey: body.apiKey } : {}),
    });
    return c.json({
      ...serializeS2sClient(result.client),
      apiKey: result.apiKey,
    }, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};

export const revokeS2sClientHandler: AppRouteHandler<typeof revokeS2sClientRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor || actor.kind !== "platform") {
    return unauthorizedResponse(c);
  }

  try {
    const { id } = c.req.valid("param");
    const client = await revokeS2sClient(c.get("schoolApp").repositories.s2sClients, actor, id);
    return c.json(serializeS2sClient(client), HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};

export const rotateS2sClientKeyHandler: AppRouteHandler<typeof rotateS2sClientKeyRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor || actor.kind !== "platform") {
    return unauthorizedResponse(c);
  }

  try {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await rotateS2sClientKey(
      c.get("schoolApp").repositories.s2sClients,
      actor,
      id,
      body.apiKey,
    );
    return c.json({ apiKey: result.apiKey }, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
