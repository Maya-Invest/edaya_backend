import { admitIdentityOnlyEntry } from "@/lib/school-api/identity-only-entry";
import { routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import type { AppRouteHandler } from "@/http/types";
import { serializeCommandResult } from "@/lib/school-api/dispatch/commands";
import { clientRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";
import { AccountInvitationContactChannel, AccountInvitationKind, AccountInvitationStatus } from "@edaya/core";
import { hashInvitationToken, resolveInviteeDisplayName } from "@edaya/service";
import type { AccountInvitation, Guardian, StaffMember, Student } from "@edaya/core";
import type { SchoolRepositories } from "@edaya/service";
import { createRoute, z } from "@hono/zod-openapi";
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

const sessionInvitationSchema = z.object({
  id: z.string(),
  kind: z.literal(AccountInvitationKind.Guardian),
  status: z.nativeEnum(AccountInvitationStatus),
  expiresAt: z.coerce.date(),
  schoolName: z.string(),
  inviteeName: z.string(),
  contactChannel: z.string(),
}).openapi("SessionInvitation");

const listMyInvitationsResponseSchema = z.object({
  invitations: z.array(sessionInvitationSchema),
}).openapi("ListMyInvitationsResponse");

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

export const listMyInvitationsRoute = createRoute({
  method: "get",
  path: "/public/me/invitations",
  tags: ["Public Invitations"],
  summary: "List pending guardian invitations for the signed-in identity",
  ...clientRouteOperation({
    namespace: "public",
    clientKey: "listMyInvitations",
    path: "public/me/invitations",
    basePath: "root",
    responseSchemaName: "ListMyInvitationsResponse",
  }),
  responses: {
    [HttpStatusCodes.OK]: jsonContent(listMyInvitationsResponseSchema, "Pending invitations for this identity"),
    ...coreRouteErrorResponses,
  },
});

export const acceptMyInvitationRoute = createRoute({
  method: "post",
  path: "/public/me/invitations/{invitationId}/accept",
  tags: ["Public Invitations"],
  summary: "Accept a pending guardian invitation for the signed-in identity",
  ...clientRouteOperation({
    namespace: "public",
    clientKey: "acceptMyInvitation",
    path: "public/me/invitations/{invitationId}/accept",
    pathParams: ["invitationId"],
    basePath: "root",
    responseSchemaName: "AcceptInvitationResponse",
  }),
  request: {
    params: z.object({
      invitationId: z.string().min(1),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(acceptInvitationResponseSchema, "Linked actor"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(createMessageObjectSchema(), "Invitation not found"),
    ...coreRouteErrorResponses,
  },
});

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

async function toSessionInvitation(
  repositories: SchoolRepositories,
  invitation: AccountInvitation,
): Promise<z.infer<typeof sessionInvitationSchema>> {
  const school = await repositories.schools.findById(invitation.schoolId);
  const inviteeName = await resolveInviteeName(repositories, invitation);
  return {
    id: invitation.id,
    kind: AccountInvitationKind.Guardian,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    schoolName: school?.name ?? "School",
    inviteeName,
    contactChannel: invitation.contactChannel,
  };
}

export const listMyInvitationsHandler: AppRouteHandler<typeof listMyInvitationsRoute> = async (c) => {
  const entry = await admitIdentityOnlyEntry({
    headers: c.req.raw.headers,
    identityClient: c.var.identityClient,
    schoolApp: c.var.schoolApp,
    selectedActor: c.var.actor,
  });
  if (!entry) {
    return unauthorizedResponse(c);
  }

  const invitations = await entry.listMyInvitations();
  const repositories = c.var.schoolApp.repositories;
  return c.json({
    invitations: await Promise.all(invitations.map(invitation => toSessionInvitation(repositories, invitation))),
  }, HttpStatusCodes.OK);
};

export const acceptMyInvitationHandler: AppRouteHandler<typeof acceptMyInvitationRoute> = async (c) => {
  const entry = await admitIdentityOnlyEntry({
    headers: c.req.raw.headers,
    identityClient: c.var.identityClient,
    schoolApp: c.var.schoolApp,
    selectedActor: c.var.actor,
  });
  if (!entry) {
    return unauthorizedResponse(c);
  }

  try {
    const result = await entry.acceptInvitationById(c.req.valid("param").invitationId);
    if (!result) {
      return c.json({ message: "Invitation not found" }, HttpStatusCodes.NOT_FOUND);
    }
    return c.json(
      serializeCommandResult(result) as z.infer<typeof acceptInvitationResponseSchema>,
      HttpStatusCodes.OK,
    );
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};

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
  const entry = await admitIdentityOnlyEntry({
    headers: c.req.raw.headers,
    identityClient: c.var.identityClient,
    schoolApp: c.var.schoolApp,
    selectedActor: c.var.actor,
  });
  if (!entry) {
    return unauthorizedResponse(c);
  }

  try {
    const result = await entry.acceptInvitation(c.req.valid("param").token);
    if (!result) {
      return c.json({ message: "Invitation not found" }, HttpStatusCodes.NOT_FOUND);
    }
    return c.json(
      serializeCommandResult(result) as z.infer<typeof acceptInvitationResponseSchema>,
      HttpStatusCodes.OK,
    );
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};
