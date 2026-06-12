import { randomUUID } from "node:crypto";
import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";
import type { AppRouteHandler } from "@/lib/http/types";
import {
  conflictResponse,
  routeErrorResponse,
  unauthorizedResponse,
} from "@/lib/http/responses";
import {
  type AuthSessionProvider,
  resolveAuthenticatedSession,
} from "@/lib/http/dependencies/session-actor";
import { registerSchoolWithOwner } from "@/lib/onboarding/register-school-with-owner";
import { serializeCommandResult } from "@/lib/school-api/dispatch/commands";
import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";
import { schoolApiPath } from "@/lib/school-api/routes/paths";
import { shouldAllowPublicSchoolRegistration } from "@/lib/runtime/env";
import { BusinessRuleViolationError, SchoolType } from "@edaya/core";
import { schoolResponseSchema } from "@/lib/school-api/schemas/entities";

const commandMessageSchema = createMessageObjectSchema();

const onboardingRegisterSchoolRequestSchema = z.object({
  name: z.string().trim().min(1),
  timeZone: z.string().trim().min(1),
  type: z.nativeEnum(SchoolType).nullable().optional(),
  country: z.string().trim().min(1).nullable().optional(),
  city: z.string().trim().min(1).nullable().optional(),
}).openapi("OnboardingRegisterSchoolRequest");

export const onboardingRegisterSchoolRoute = createRoute({
  method: "post",
  path: schoolApiPath("onboarding", "register-school"),
  tags: ["Core Onboarding"],
  summary: "Register a school and make the current user its owner (dev bootstrap)",
  request: {
    body: jsonContent(onboardingRegisterSchoolRequestSchema, "School registration payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(schoolResponseSchema, "Registered school"),
    [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(commandMessageSchema, "Public school registration is disabled"),
    ...coreRouteErrorResponses,
  },
});

export const onboardingRegisterSchoolHandler: AppRouteHandler<typeof onboardingRegisterSchoolRoute> = async (c) => {
  if (!shouldAllowPublicSchoolRegistration(c.env)) {
    return c.json(
      { message: "Public school registration is disabled" },
      HttpStatusCodes.SERVICE_UNAVAILABLE,
    );
  }

  const session = await resolveAuthenticatedSession(
    c.var.auth as AuthSessionProvider,
    c.req.raw.headers,
  );
  if (!session) {
    return unauthorizedResponse(c);
  }

  if (c.get("actor")) {
    return conflictResponse(c, new BusinessRuleViolationError(
      "SUBJECT_ALREADY_LINKED",
      "This account is already linked to a school actor",
    ));
  }

  const body = c.req.valid("json");
  const requestId = c.req.header("x-request-id")?.trim() || randomUUID();

  try {
    const result = await registerSchoolWithOwner(c.get("schoolApp"), session, {
      name: body.name,
      timeZone: body.timeZone,
      ...(body.type ? { type: body.type } : {}),
      ...(body.country ? { country: body.country } : {}),
      ...(body.city ? { city: body.city } : {}),
      requestId,
    });

    return c.json(
      serializeCommandResult(result.school) as z.infer<typeof schoolResponseSchema>,
      HttpStatusCodes.OK,
    );
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
