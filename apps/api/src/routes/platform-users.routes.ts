import type { AppRouteHandler } from "@/http/types";
import { routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import {
  createPlatformUserRequestSchema,
  platformMeResponseSchema,
  platformUserResponseSchema,
  serializePlatformUser,
} from "@/lib/platform/schemas";
import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";
import { clientRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { schoolApiPath } from "@/lib/school-api/routes/paths";
import { BusinessRuleViolationError } from "@edaya/core";
import { createPlatformUser, deactivatePlatformUser, listPlatformUsers, PlatformPolicies } from "@edaya/authorization";
import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

export const getPlatformMeRoute = createRoute({
  method: "get",
  path: schoolApiPath("platform", "me"),
  tags: ["Core Platform"],
  summary: "Return the current platform operator",
  ...clientRouteOperation({
    namespace: "platformUsers",
    clientKey: "me",
    path: "platform/me",
    responseSchemaName: "PlatformMeResponse",
  }),
  responses: {
    [HttpStatusCodes.OK]: jsonContent(platformMeResponseSchema, "Current platform operator"),
    ...coreRouteErrorResponses,
  },
});

export const listPlatformUsersRoute = createRoute({
  method: "get",
  path: schoolApiPath("platform-users"),
  tags: ["Core Platform"],
  summary: "List platform operators",
  ...clientRouteOperation({
    namespace: "platformUsers",
    clientKey: "list",
    path: "platform-users",
    responseSchemaName: "PlatformUserResponse",
    responseIsArray: true,
  }),
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.array(platformUserResponseSchema), "Platform operators"),
    ...coreRouteErrorResponses,
  },
});

export const createPlatformUserRoute = createRoute({
  method: "post",
  path: schoolApiPath("platform-users"),
  tags: ["Core Platform"],
  summary: "Create a platform operator for an existing identity user",
  ...clientRouteOperation({
    namespace: "platformUsers",
    clientKey: "create",
    path: "platform-users",
    requestSchemaName: "CreatePlatformUserRequest",
    responseSchemaName: "PlatformUserResponse",
  }),
  request: {
    body: jsonContent(createPlatformUserRequestSchema, "Platform operator payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(platformUserResponseSchema, "Created platform operator"),
    ...coreRouteErrorResponses,
  },
});

export const deactivatePlatformUserRoute = createRoute({
  method: "post",
  path: schoolApiPath("platform-users", "{id}", "deactivate"),
  tags: ["Core Platform"],
  summary: "Deactivate a platform operator",
  ...clientRouteOperation({
    namespace: "platformUsers",
    clientKey: "deactivate",
    path: "platform-users/{id}/deactivate",
    pathParams: ["id"],
    responseSchemaName: "PlatformUserResponse",
  }),
  request: {
    params: z.object({ id: z.string().trim().min(1) }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(platformUserResponseSchema, "Deactivated platform operator"),
    ...coreRouteErrorResponses,
  },
});

export const getPlatformMeHandler: AppRouteHandler<typeof getPlatformMeRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor || actor.kind !== "platform") {
    return unauthorizedResponse(c);
  }

  try {
    const user = await new PlatformPolicies(actor, c.var.schoolApp.repositories.platformUsers).currentUser();
    return c.json({ kind: "platform" as const, actorId: user.id, subjectId: user.subjectId,
      email: user.email, permissions: [...user.permissions], assuranceLevel: actor.assuranceLevel }, HttpStatusCodes.OK);
  } catch (err) { return routeErrorResponse(c, err); }
};

export const listPlatformUsersHandler: AppRouteHandler<typeof listPlatformUsersRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor || actor.kind !== "platform") {
    return unauthorizedResponse(c);
  }

  try {
    const users = await listPlatformUsers(c.get("schoolApp").repositories.platformUsers, actor);
    return c.json(users.map(serializePlatformUser), HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};

export const createPlatformUserHandler: AppRouteHandler<typeof createPlatformUserRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor || actor.kind !== "platform") {
    return unauthorizedResponse(c);
  }

  try {
    const body = c.req.valid("json");
    await new PlatformPolicies(actor, c.var.schoolApp.repositories.platformUsers).createUser(body.permissions);
    const lookup = await c.var.identityClient.directory.lookupByContact("email", body.email);
    if (!lookup?.exists || !lookup.id) {
      throw new BusinessRuleViolationError(
        "PLATFORM_USER_IDENTITY_NOT_FOUND",
        "Identity user does not exist for this email",
      );
    }

    const user = await createPlatformUser(c.get("schoolApp").repositories.platformUsers, actor, {
      subjectId: lookup.id,
      email: body.email,
      ...(body.permissions ? { permissions: body.permissions } : {}),
    }, c.var.schoolApp.atomicExecution);
    return c.json(serializePlatformUser(user), HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};

export const deactivatePlatformUserHandler: AppRouteHandler<typeof deactivatePlatformUserRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor || actor.kind !== "platform") {
    return unauthorizedResponse(c);
  }

  try {
    const { id } = c.req.valid("param");
    const user = await deactivatePlatformUser(c.get("schoolApp").repositories.platformUsers, actor, id, c.var.schoolApp.atomicExecution);
    return c.json(serializePlatformUser(user), HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
