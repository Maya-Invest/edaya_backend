import type { AuthenticatedSession, AuthSessionProvider } from "@/http/dependencies/session-actor";
import { resolveAuthenticatedSession } from "@/http/dependencies/session-actor";
import {
  conflictResponse,
  routeErrorResponse,
  unauthorizedResponse,
} from "@/http/responses";
import type { AppRouteHandler } from "@/http/types";
import { registerSchoolWithOwner } from "@/lib/onboarding/register-school-with-owner";
import { applyStructureTemplate } from "@/lib/onboarding/apply-structure-template";
import { inviteStaffMembers } from "@/lib/onboarding/invite-staff-members";
import { isGradeLevelTemplateKey } from "@/lib/onboarding/structure-templates";
import { isOnboardingStaffInviteRoleKey } from "@/lib/onboarding/staff-invite-roles";
import { resolveInviteBaseUrl, shouldAllowPublicSchoolRegistration } from "@/runtime/shared/env/derived";
import { serializeCommandResult } from "@/lib/school-api/dispatch/commands";
import { schoolApiPath } from "@/lib/school-api/routes/paths";
import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";
import { schoolResponseSchema } from "@/lib/school-api/schemas/entities";
import { BusinessRuleViolationError, SchoolType } from "@edaya/core";
import { createRoute, z } from "@hono/zod-openapi";
import { randomUUID } from "node:crypto";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

const commandMessageSchema = createMessageObjectSchema();

const onboardingRegisterSchoolRequestSchema = z.object({
  name: z.string().trim().min(1),
  timeZone: z.string().trim().min(1),
  type: z.nativeEnum(SchoolType).nullable().optional(),
  country: z.string().trim().min(1).nullable().optional(),
  city: z.string().trim().min(1).nullable().optional(),
  id: z.string().trim().min(1).optional(),
  ownerStaffId: z.string().trim().min(1).optional(),
  ownerFirstName: z.string().trim().min(1).optional(),
  ownerLastName: z.string().trim().min(1).optional(),
  ownerEmail: z.string().trim().email().optional(),
}).openapi("OnboardingRegisterSchoolRequest");

const onboardingStructureModelSchema = z.enum(["college", "lycee"]);

const onboardingApplyStructureTemplateRequestSchema = z.object({
  models: z.array(onboardingStructureModelSchema).min(1),
  levels: z.array(z.object({
    gradeLevelId: z.string().trim().min(1).refine(isGradeLevelTemplateKey, "Invalid grade level template key"),
    classCount: z.number().int().min(1),
    capacity: z.number().int().min(1),
  })).min(1),
}).openapi("OnboardingApplyStructureTemplateRequest");

const onboardingApplyStructureTemplateResponseSchema = z.object({
  gradeLevelCount: z.number().int(),
  classGroupCount: z.number().int(),
  subjectCount: z.number().int(),
  classSubjectCount: z.number().int(),
}).openapi("OnboardingApplyStructureTemplateResponse");

const onboardingStaffInviteRequestSchema = z.object({
  invites: z.array(z.object({
    email: z.string().trim().email(),
    role: z.string().trim().min(1).refine(isOnboardingStaffInviteRoleKey, "Invalid staff invite role"),
  })),
}).openapi("OnboardingInviteStaffMembersRequest");

const onboardingStaffInviteResponseSchema = z.object({
  invitedCount: z.number().int(),
  accessRolesEnsured: z.number().int(),
}).openapi("OnboardingInviteStaffMembersResponse");

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
    const result = await registerSchoolWithOwner(c.get("schoolApp"), toOwnerSession(session), {
      name: body.name,
      timeZone: body.timeZone,
      ...(body.type ? { type: body.type } : {}),
      ...(body.country ? { country: body.country } : {}),
      ...(body.city ? { city: body.city } : {}),
      ...(body.id ? { id: body.id } : {}),
      ...(body.ownerStaffId ? { ownerStaffId: body.ownerStaffId } : {}),
      ...(body.ownerFirstName ? { ownerFirstName: body.ownerFirstName } : {}),
      ...(body.ownerLastName ? { ownerLastName: body.ownerLastName } : {}),
      ...(body.ownerEmail ? { ownerEmail: body.ownerEmail } : {}),
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

export const onboardingApplyStructureTemplateRoute = createRoute({
  method: "post",
  path: schoolApiPath("onboarding", "apply-structure-template"),
  tags: ["Core Onboarding"],
  summary: "Apply collège / lycée structure template for the current school",
  request: {
    body: jsonContent(onboardingApplyStructureTemplateRequestSchema, "Structure template payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(onboardingApplyStructureTemplateResponseSchema, "Applied structure summary"),
    ...coreRouteErrorResponses,
  },
});

export const onboardingApplyStructureTemplateHandler: AppRouteHandler<typeof onboardingApplyStructureTemplateRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const body = c.req.valid("json");

  try {
    const result = await applyStructureTemplate(c.get("schoolApp"), actor, body);
    return c.json(result, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};

export const onboardingInviteStaffMembersRoute = createRoute({
  method: "post",
  path: schoolApiPath("onboarding", "invite-staff-members"),
  tags: ["Core Onboarding"],
  summary: "Invite staff members during school onboarding",
  request: {
    body: jsonContent(onboardingStaffInviteRequestSchema, "Staff invitation payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(onboardingStaffInviteResponseSchema, "Invitation summary"),
    ...coreRouteErrorResponses,
  },
});

export const onboardingInviteStaffMembersHandler: AppRouteHandler<typeof onboardingInviteStaffMembersRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const body = c.req.valid("json");

  try {
    const result = await inviteStaffMembers(c.get("schoolApp"), actor, body, {
      inviteBaseUrl: resolveInviteBaseUrl(c.env),
    });
    return c.json(result, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};

function toOwnerSession(session: AuthenticatedSession) {
  return {
    user: {
      id: session.user.id,
      ...(session.user.email ? { email: session.user.email } : {}),
      ...(session.user.name ? { name: session.user.name } : {}),
    },
  };
}
