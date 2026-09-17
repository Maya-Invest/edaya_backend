import { listIdentitiesForSubject } from "@edaya/authorization";
import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";
import type { AppRouteHandler } from "@/http/types";
import { getErrorMessage, unauthorizedResponse } from "@/http/responses";
import { resolveAuthenticatedSession } from "@/http/dependencies/session-actor";
import { clientRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { schoolApiPath } from "@/lib/school-api/routes/paths";

const commandMessageSchema = createMessageObjectSchema();

const authorizationProfileSchema = z.object({
  kind: z.enum(["staff", "guardian", "student", "teacher"]),
  actorId: z.string(),
  schoolId: z.string(),
  schoolName: z.string(),
  schoolShortName: z.string(),
}).openapi("AuthorizationProfile");

const authorizationProfilesResponseSchema = z.object({
  profiles: z.array(authorizationProfileSchema),
}).openapi("AuthorizationProfilesResponse");

export const getAuthorizationProfilesRoute = createRoute({
  method: "get",
  path: schoolApiPath("authorization", "profiles"),
  tags: ["Core Authorization"],
  summary: "List school identities for the signed-in subject",
  ...clientRouteOperation({
    namespace: "authorization",
    clientKey: "profiles",
    path: "authorization/profiles",
    responseSchemaName: "AuthorizationProfilesResponse",
  }),
  responses: {
    [HttpStatusCodes.OK]: jsonContent(authorizationProfilesResponseSchema, "School identities for this identity"),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(commandMessageSchema, "Missing or invalid authorization session"),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(commandMessageSchema, "Internal server error occurred"),
  },
});

export const getAuthorizationProfilesHandler: AppRouteHandler<typeof getAuthorizationProfilesRoute> = async (c) => {
  const session = await resolveAuthenticatedSession(c.req.raw.headers, c.var.identityClient);
  if (!session) {
    return unauthorizedResponse(c);
  }

  try {
    const repositories = c.get("schoolApp").repositories;
    const identities = await listIdentitiesForSubject(repositories, session.user.id);
    const schoolIds = [...new Set(identities.map(identity => identity.schoolId))];
    const schools = schoolIds.length > 0
      ? await repositories.schools.findByIds(schoolIds)
      : [];
    const schoolById = new Map(schools.map(school => [school.id, school]));

    return c.json({
      profiles: identities.flatMap((identity) => {
        const school = schoolById.get(identity.schoolId);
        if (!school) {
          return [];
        }
        return [{
          kind: identity.kind,
          actorId: identity.actorId,
          schoolId: identity.schoolId,
          schoolName: school.name,
          schoolShortName: deriveSchoolShortName(school.name),
        }];
      }),
    }, HttpStatusCodes.OK);
  }
  catch (err) {
    return c.json({ message: getErrorMessage(err) }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

export function deriveSchoolShortName(name: string): string {
  const emDashParts = name.split("—");
  if (emDashParts.length > 1) {
    const tail = emDashParts[emDashParts.length - 1]?.trim();
    if (tail) {
      return tail;
    }
  }
  const hyphenParts = name.split(" - ");
  if (hyphenParts.length > 1) {
    const tail = hyphenParts[hyphenParts.length - 1]?.trim();
    if (tail) {
      return tail;
    }
  }
  return name.split(/\s+/)[0] ?? name;
}
