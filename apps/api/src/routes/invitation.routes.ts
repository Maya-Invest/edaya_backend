import type { ApiSchoolApplication } from "@/lib/school-api/application";
import { resolveAuthenticatedSession } from "@/http/dependencies/session-actor";
import { conflictResponse, routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import type { AppRouteHandler } from "@/http/types";
import { serializeCommandResult } from "@/lib/school-api/dispatch/commands";
import { clientRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";
import { AccountInvitationContactChannel, AccountInvitationKind, AccountInvitationStatus, BusinessRuleViolationError } from "@edaya/core";
import { hashInvitationToken, resolveInviteeDisplayName } from "@edaya/service";
import { createSystemActorMetadata } from "@edaya/authorization";
import type { AccountInvitation, Guardian, StaffMember, Student } from "@edaya/core";
import type { ActorMetadata } from "@edaya/authorization";
import type { SchoolRepositories } from "@edaya/service";
import { createRoute, z } from "@hono/zod-openapi";
import { randomUUID } from "node:crypto";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

const invitationPreviewResponseSchema = z.object({
  status: z.nativeEnum(AccountInvitationStatus),
  kind: z.nativeEnum(AccountInvitationKind),
  targetId: z.string(),
  expiresAt: z.coerce.date(),
  schoolName: z.string(),
  inviteeName: z.string(),
  contactChannel: z.string(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  authAccountExists: z.boolean().optional(),
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
  ...clientRouteOperation({
    namespace: "public",
    clientKey: "previewInvitation",
    path: "public/invitations/{token}",
    pathParams: ["token"],
    basePath: "root",
    responseSchemaName: "InvitationPreviewResponse",
  }),
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
  ...clientRouteOperation({
    namespace: "public",
    clientKey: "acceptInvitation",
    path: "public/invitations/{token}/accept",
    pathParams: ["token"],
    basePath: "root",
    responseSchemaName: "AcceptInvitationResponse",
  }),
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
  if (invitation.kind === AccountInvitationKind.Teacher) {
    const teacher = await repositories.teachers.findById(invitation.targetId);
    return teacher ? resolveInviteeDisplayName(teacher) : "Teacher";
  }
  const student = await repositories.students.findById(invitation.targetId) as Student | undefined;
  return student ? resolveInviteeDisplayName(student) : "Student";
}

function actorMatchesInvitationTarget(actor: ActorMetadata, invitation: AccountInvitation): boolean {
  switch (invitation.kind) {
    case AccountInvitationKind.Staff:
      return actor.kind === "staff" && actor.staffMemberId === invitation.targetId;
    case AccountInvitationKind.Guardian:
      return actor.kind === "guardian" && actor.guardianId === invitation.targetId;
    case AccountInvitationKind.Student:
      return actor.kind === "student" && actor.studentId === invitation.targetId;
    case AccountInvitationKind.Teacher:
      return actor.kind === "teacher" && actor.teacherId === invitation.targetId;
  }
  return false;
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

  let authAccountExists: boolean | undefined;
  if (invitation.contactChannel === AccountInvitationContactChannel.Email && invitation.contactValue) {
    authAccountExists = await c.get("schoolApp").hasAuthAccountForEmail(invitation.contactValue);
  }
  else if (invitation.contactChannel === AccountInvitationContactChannel.Phone && invitation.contactValue) {
    authAccountExists = await c.get("schoolApp").hasAuthAccountForPhone(invitation.contactValue);
  }

  return c.json({
    status: invitation.status,
    kind: invitation.kind,
    targetId: invitation.targetId,
    expiresAt: invitation.expiresAt,
    schoolName: school?.name ?? "School",
    inviteeName,
    contactChannel: invitation.contactChannel,
    ...(invitation.contactChannel === AccountInvitationContactChannel.Email
      ? {
          contactEmail: invitation.contactValue,
          ...(authAccountExists !== undefined ? { authAccountExists } : {}),
        }
      : {
          contactPhone: invitation.contactValue,
          ...(authAccountExists !== undefined ? { authAccountExists } : {}),
        }),
  }, HttpStatusCodes.OK);
};

export const acceptInvitationHandler: AppRouteHandler<typeof acceptInvitationRoute> = async (c) => {
  const session = await resolveAuthenticatedSession(
    c.req.raw.headers,
    c.var.identityClient,
  );
  if (!session) {
    return unauthorizedResponse(c);
  }

  const token = c.req.valid("param").token;
  const invitation = await findInvitationByToken(c.get("schoolApp").repositories, token);
  if (!invitation) {
    return c.json({ message: "Invitation not found" }, HttpStatusCodes.NOT_FOUND);
  }

  const actor = c.get("actor");
  if (actor && !actorMatchesInvitationTarget(actor, invitation)) {
    return conflictResponse(c, new BusinessRuleViolationError(
      "SUBJECT_ALREADY_LINKED",
      "This account is already linked to a school actor",
    ));
  }

  const requestId = c.req.header("x-request-id")?.trim() || randomUUID();
  const service = createInvitationSystemService(c.get("schoolApp"), invitation.schoolId, requestId);

  try {
    const result = await service.accountInvitationWorkflow.acceptAccountInvitation({
      token,
      subjectId: session.user.id,
      contactValue: invitation.contactChannel === AccountInvitationContactChannel.Email
        ? session.user.email
        : session.user.phone,
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
