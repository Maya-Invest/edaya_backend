import type { ApiSchoolApplication } from "@/lib/school-api/application";
import type { AuthSessionProvider } from "@/http/dependencies/session-actor";
import { normalizeAuthSession, resolveAuthenticatedSession } from "@/http/dependencies/session-actor";
import { conflictResponse, routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import type { AppRouteHandler } from "@/http/types";
import { serializeCommandResult } from "@/lib/school-api/dispatch/commands";
import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";
import {
  type AccountInvitation,
  AccountInvitationKind,
  AccountInvitationStatus,
  BusinessRuleViolationError,
  createSystemActorMetadata,
  type Guardian,
  hashInvitationToken,
  resolveInviteeDisplayName,
  type SchoolRepositories,
  type StaffMember,
  type Student,
} from "@edaya/core";
import { createRoute, z } from "@hono/zod-openapi";
import { randomUUID } from "node:crypto";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

const invitationPreviewResponseSchema = z.object({
  status: z.nativeEnum(AccountInvitationStatus),
  kind: z.nativeEnum(AccountInvitationKind),
  expiresAt: z.coerce.date(),
  schoolName: z.string(),
  inviteeName: z.string(),
  contactChannel: z.string(),
}).openapi("InvitationPreviewResponse");

const acceptInvitationResponseSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("staff"),
    entity: z.record(z.unknown()),
  }),
  z.object({
    kind: z.literal("guardian"),
    entity: z.record(z.unknown()),
  }),
  z.object({
    kind: z.literal("student"),
    entity: z.record(z.unknown()),
  }),
]).openapi("AcceptInvitationResponse");

export const invitationPreviewRoute = createRoute({
  method: "get",
  path: "/public/invitations/{token}",
  tags: ["Public Invitations"],
  summary: "Preview an account invitation",
  request: {
    params: z.object({
      token: z.string().min(1),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(invitationPreviewResponseSchema, "Invitation preview"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(createMessageObjectSchema(), "Invitation not found"),
    ...coreRouteErrorResponses,
  },
});

export const acceptInvitationRoute = createRoute({
  method: "post",
  path: "/public/invitations/{token}/accept",
  tags: ["Public Invitations"],
  summary: "Accept an account invitation for the signed-in user",
  request: {
    params: z.object({
      token: z.string().min(1),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(acceptInvitationResponseSchema, "Linked actor"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(createMessageObjectSchema(), "Invitation not found"),
    ...coreRouteErrorResponses,
  },
});

async function findInvitationByToken(
  repositories: SchoolRepositories,
  token: string,
): Promise<AccountInvitation | undefined> {
  return repositories.accountInvitations.findByTokenHash(hashInvitationToken(token));
}

async function resolveInviteeName(
  repositories: SchoolRepositories,
  invitation: AccountInvitation,
): Promise<string> {
  if (invitation.kind === AccountInvitationKind.Staff) {
    const staff = await repositories.staffMembers.findById(invitation.targetId) as StaffMember | undefined;
    return staff ? resolveInviteeDisplayName(staff) : "Staff member";
  }
  if (invitation.kind === AccountInvitationKind.Guardian) {
    const guardian = await repositories.guardians.findById(invitation.targetId) as Guardian | undefined;
    return guardian ? resolveInviteeDisplayName(guardian) : "Guardian";
  }
  const student = await repositories.students.findById(invitation.targetId) as Student | undefined;
  return student ? resolveInviteeDisplayName(student) : "Student";
}

function createInvitationSystemService(
  schoolApp: ApiSchoolApplication,
  schoolId: string,
  requestId: string,
) {
  return schoolApp.forActor(createSystemActorMetadata({
    schoolId,
    systemId: "account-invitation-public",
    requestId,
    reason: "public-invitation-accept",
  }));
}

export const invitationPreviewHandler: AppRouteHandler<typeof invitationPreviewRoute> = async (c) => {
  const token = c.req.valid("param").token;
  const invitation = await findInvitationByToken(c.get("schoolApp").repositories, token);
  if (!invitation) {
    return c.json({ message: "Invitation not found" }, HttpStatusCodes.NOT_FOUND);
  }

  const school = await c.get("schoolApp").repositories.schools.findById(invitation.schoolId);
  const inviteeName = await resolveInviteeName(c.get("schoolApp").repositories, invitation);

  return c.json({
    status: invitation.status,
    kind: invitation.kind,
    expiresAt: invitation.expiresAt,
    schoolName: school?.name ?? "School",
    inviteeName,
    contactChannel: invitation.contactChannel,
  }, HttpStatusCodes.OK);
};

export const acceptInvitationHandler: AppRouteHandler<typeof acceptInvitationRoute> = async (c) => {
  const session = await resolveAuthenticatedSession(
    c.var.auth as AuthSessionProvider,
    c.req.raw.headers,
  );
  const normalized = normalizeAuthSession(session);
  if (!normalized?.user.email) {
    return unauthorizedResponse(c);
  }

  if (c.get("actor")) {
    return conflictResponse(c, new BusinessRuleViolationError(
      "SUBJECT_ALREADY_LINKED",
      "This account is already linked to a school actor",
    ));
  }

  const token = c.req.valid("param").token;
  const invitation = await findInvitationByToken(c.get("schoolApp").repositories, token);
  if (!invitation) {
    return c.json({ message: "Invitation not found" }, HttpStatusCodes.NOT_FOUND);
  }

  const requestId = c.req.header("x-request-id")?.trim() || randomUUID();
  const service = createInvitationSystemService(c.get("schoolApp"), invitation.schoolId, requestId);

  try {
    const result = await service.accountInvitationWorkflow.acceptAccountInvitation({
      token,
      subjectId: normalized.user.id,
      contactEmail: normalized.user.email,
    });
    return c.json(
      serializeCommandResult(result) as z.infer<typeof acceptInvitationResponseSchema>,
      HttpStatusCodes.OK,
    );
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
