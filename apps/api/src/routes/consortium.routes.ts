import type { AuthSessionProvider } from "@/http/dependencies/session-actor";
import { resolveAuthenticatedSession } from "@/http/dependencies/session-actor";
import {
  forbiddenResponse,
  routeErrorResponse,
  unauthorizedResponse,
} from "@/http/responses";
import type { AppRouteHandler } from "@/http/types";
import {
  assertConsortiumOwner,
  buildConsortiumDashboard,
  createConsortium,
  findConsortiumOwnedBySubject,
  listConsortiumSchools,
  updateConsortiumSharedRules,
} from "@/lib/consortium/consortium-service";
import { assignConsortiumSchoolOwner } from "@/lib/consortium/assign-school-owner";
import { applyStructureTemplate } from "@/lib/onboarding/apply-structure-template";
import { clientRouteOperation } from "@/lib/school-api/openapi/client-extensions";
import { schoolApiPath } from "@/lib/school-api/routes/paths";
import { coreRouteErrorResponses } from "@/lib/school-api/routes/shared";
import { BusinessRuleViolationError } from "@edaya/core";
import { isStructureTemplateId } from "@edaya/fixtures/onboarding";
import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { resolveInviteBaseUrl } from "@/runtime/shared/env/derived";
import { randomUUID } from "node:crypto";

const sharedRulesSchema = z.object({
  structureTemplateIds: z.array(z.string().trim().min(1)).default([]),
}).openapi("ConsortiumSharedRules");

const consortiumSchema = z.object({
  id: z.string(),
  name: z.string(),
  country: z.string().optional(),
  ownerSubjectId: z.string(),
  sharedRules: sharedRulesSchema,
  createdAt: z.string(),
}).openapi("Consortium");

const createConsortiumRequestSchema = z.object({
  name: z.string().trim().min(1),
  country: z.string().trim().min(1).optional(),
  id: z.string().trim().min(1).optional(),
  sharedRules: sharedRulesSchema.optional(),
}).openapi("CreateConsortiumRequest");

const updateSharedRulesRequestSchema = z.object({
  sharedRules: sharedRulesSchema,
}).openapi("UpdateConsortiumSharedRulesRequest");

const applySharedRulesRequestSchema = z.object({
  schoolId: z.string().trim().min(1),
  levels: z.array(z.object({
    gradeLevelId: z.string().trim().min(1),
    classCount: z.number().int().min(1),
    capacity: z.number().int().min(1),
    classNamingMode: z.enum(["alphabetical", "numerical"]).optional(),
  })).min(1),
}).openapi("ApplyConsortiumSharedRulesRequest");

const consortiumSchoolSchema = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string().optional(),
  country: z.string().optional(),
  timeZone: z.string(),
  consortiumId: z.string().optional(),
}).openapi("ConsortiumSchool");

const consortiumDashboardSchema = z.object({
  consortium: z.object({
    id: z.string(),
    name: z.string(),
    country: z.string().optional(),
    sharedRules: sharedRulesSchema,
  }),
  schoolCount: z.number().int(),
  totals: z.object({
    studentCount: z.number().int(),
    staffCount: z.number().int(),
    overdueFeeCount: z.number().int(),
    overdueFeeAmount: z.number(),
    recentPaymentAmount: z.number(),
    absencesToday: z.number().int(),
    openIncidentCount: z.number().int(),
  }),
  schools: z.array(z.object({
    schoolId: z.string(),
    schoolName: z.string(),
    studentCount: z.number().int(),
    staffCount: z.number().int(),
    overdueFeeCount: z.number().int(),
    overdueFeeAmount: z.number(),
    recentPaymentAmount: z.number(),
    absencesToday: z.number().int(),
    openIncidentCount: z.number().int(),
    ownerSubjectId: z.string().optional(),
    ownerName: z.string().optional(),
    ownerEmail: z.string().optional(),
    ownerStatus: z.enum(["assigned", "pending_invite", "unassigned"]),
    assignableStaff: z.array(z.object({
      subjectId: z.string(),
      name: z.string(),
      email: z.string().optional(),
    })),
  })),
}).openapi("ConsortiumDashboard");

const assignSchoolOwnerRequestSchema = z.object({
  subjectId: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
}).refine(
  value => Boolean(value.subjectId) !== Boolean(value.email),
  { message: "Provide exactly one of subjectId or email" },
).openapi("AssignConsortiumSchoolOwnerRequest");

const assignSchoolOwnerResponseSchema = z.object({
  schoolId: z.string(),
  ownerSubjectId: z.string().optional(),
  pendingOwnerStaffId: z.string().optional(),
  ownerStatus: z.enum(["assigned", "pending_invite"]),
}).openapi("AssignConsortiumSchoolOwnerResponse");

function serializeConsortium(consortium: {
  id: string
  name: string
  country?: string
  ownerSubjectId: string
  sharedRules: { structureTemplateIds: string[] }
  createdAt: Date
}) {
  return {
    id: consortium.id,
    name: consortium.name,
    ...(consortium.country ? { country: consortium.country } : {}),
    ownerSubjectId: consortium.ownerSubjectId,
    sharedRules: consortium.sharedRules,
    createdAt: consortium.createdAt.toISOString(),
  };
}

export const createConsortiumRoute = createRoute({
  method: "post",
  path: schoolApiPath("consortium", "create"),
  tags: ["Core Consortium"],
  summary: "Create a school group (consortium)",
  ...clientRouteOperation({
    namespace: "consortium",
    clientKey: "create",
    path: "consortium/create",
    requestSchemaName: "CreateConsortiumRequest",
    responseSchemaName: "Consortium",
  }),
  request: {
    body: jsonContent(createConsortiumRequestSchema, "Consortium creation payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(consortiumSchema, "Created consortium"),
    ...coreRouteErrorResponses,
  },
});

export const createConsortiumHandler: AppRouteHandler<typeof createConsortiumRoute> = async (c) => {
  const session = await resolveAuthenticatedSession(
    c.var.auth as AuthSessionProvider,
    c.req.raw.headers,
  );
  if (!session) {
    return unauthorizedResponse(c);
  }

  const body = c.req.valid("json");
  try {
    const consortium = await createConsortium(c.get("schoolApp").repositories, {
      name: body.name,
      ownerSubjectId: session.user.id,
      ...(body.country ? { country: body.country } : {}),
      ...(body.id ? { id: body.id } : {}),
      ...(body.sharedRules ? { sharedRules: body.sharedRules } : {}),
    });
    return c.json(serializeConsortium(consortium), HttpStatusCodes.OK);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};

export const getMyConsortiumRoute = createRoute({
  method: "get",
  path: schoolApiPath("consortium", "mine"),
  tags: ["Core Consortium"],
  summary: "Get the school group owned by the current user",
  ...clientRouteOperation({
    namespace: "consortium",
    clientKey: "mine",
    path: "consortium/mine",
    responseSchemaName: "Consortium",
  }),
  responses: {
    [HttpStatusCodes.OK]: jsonContent(consortiumSchema.nullable(), "Owned consortium or null"),
    ...coreRouteErrorResponses,
  },
});

export const getMyConsortiumHandler: AppRouteHandler<typeof getMyConsortiumRoute> = async (c) => {
  const session = await resolveAuthenticatedSession(
    c.var.auth as AuthSessionProvider,
    c.req.raw.headers,
  );
  if (!session) {
    return unauthorizedResponse(c);
  }

  try {
    const consortium = await findConsortiumOwnedBySubject(
      c.get("schoolApp").repositories,
      session.user.id,
    );
    return c.json(consortium ? serializeConsortium(consortium) : null, HttpStatusCodes.OK);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};

export const listConsortiumSchoolsRoute = createRoute({
  method: "get",
  path: schoolApiPath("consortium", "{consortiumId}", "schools"),
  tags: ["Core Consortium"],
  summary: "List schools in a school group",
  request: {
    params: z.object({ consortiumId: z.string().min(1) }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.array(consortiumSchoolSchema), "Consortium schools"),
    ...coreRouteErrorResponses,
  },
});

export const listConsortiumSchoolsHandler: AppRouteHandler<typeof listConsortiumSchoolsRoute> = async (c) => {
  const session = await resolveAuthenticatedSession(
    c.var.auth as AuthSessionProvider,
    c.req.raw.headers,
  );
  if (!session) {
    return unauthorizedResponse(c);
  }

  const { consortiumId } = c.req.valid("param");
  try {
    await assertConsortiumOwner(c.get("schoolApp").repositories, consortiumId, session.user.id);
    const schools = await listConsortiumSchools(c.get("schoolApp").repositories, consortiumId);
    return c.json(schools.map(school => ({
      id: school.id,
      name: school.name,
      ...(school.city ? { city: school.city } : {}),
      ...(school.country ? { country: school.country } : {}),
      timeZone: school.timeZone,
      ...(school.consortiumId ? { consortiumId: school.consortiumId } : {}),
    })), HttpStatusCodes.OK);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};

export const getConsortiumDashboardRoute = createRoute({
  method: "get",
  path: schoolApiPath("consortium", "{consortiumId}", "dashboard"),
  tags: ["Core Consortium"],
  summary: "Aggregated dashboard for a school group",
  request: {
    params: z.object({ consortiumId: z.string().min(1) }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(consortiumDashboardSchema, "Consortium dashboard"),
    ...coreRouteErrorResponses,
  },
});

export const getConsortiumDashboardHandler: AppRouteHandler<typeof getConsortiumDashboardRoute> = async (c) => {
  const session = await resolveAuthenticatedSession(
    c.var.auth as AuthSessionProvider,
    c.req.raw.headers,
  );
  if (!session) {
    return unauthorizedResponse(c);
  }

  const { consortiumId } = c.req.valid("param");
  try {
    await assertConsortiumOwner(c.get("schoolApp").repositories, consortiumId, session.user.id);
    const dashboard = await buildConsortiumDashboard(c.get("schoolApp").repositories, consortiumId);
    return c.json(dashboard, HttpStatusCodes.OK);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};

export const updateConsortiumSharedRulesRoute = createRoute({
  method: "post",
  path: schoolApiPath("consortium", "{consortiumId}", "shared-rules"),
  tags: ["Core Consortium"],
  summary: "Update shared rules pack for a school group",
  request: {
    params: z.object({ consortiumId: z.string().min(1) }),
    body: jsonContent(updateSharedRulesRequestSchema, "Shared rules payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(consortiumSchema, "Updated consortium"),
    ...coreRouteErrorResponses,
  },
});

export const updateConsortiumSharedRulesHandler: AppRouteHandler<typeof updateConsortiumSharedRulesRoute> = async (c) => {
  const session = await resolveAuthenticatedSession(
    c.var.auth as AuthSessionProvider,
    c.req.raw.headers,
  );
  if (!session) {
    return unauthorizedResponse(c);
  }

  const { consortiumId } = c.req.valid("param");
  const body = c.req.valid("json");
  try {
    const templateIds = body.sharedRules.structureTemplateIds;
    for (const id of templateIds) {
      if (!isStructureTemplateId(id)) {
        throw new BusinessRuleViolationError("INVALID_STRUCTURE_TEMPLATE", `Invalid template id: ${id}`);
      }
    }
    const consortium = await updateConsortiumSharedRules(
      c.get("schoolApp").repositories,
      consortiumId,
      session.user.id,
      { structureTemplateIds: templateIds },
    );
    return c.json(serializeConsortium(consortium), HttpStatusCodes.OK);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};

export const applyConsortiumSharedRulesRoute = createRoute({
  method: "post",
  path: schoolApiPath("consortium", "{consortiumId}", "apply-shared-rules"),
  tags: ["Core Consortium"],
  summary: "Push shared structure rules to a member school",
  request: {
    params: z.object({ consortiumId: z.string().min(1) }),
    body: jsonContent(applySharedRulesRequestSchema, "Apply shared rules payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({
      gradeLevelCount: z.number().int(),
      classGroupCount: z.number().int(),
      subjectCount: z.number().int(),
      classSubjectCount: z.number().int(),
      gradeScaleCount: z.number().int(),
      reportCardDefinitionCount: z.number().int(),
      reportCardSectionCount: z.number().int(),
    }), "Apply result"),
    ...coreRouteErrorResponses,
  },
});

export const applyConsortiumSharedRulesHandler: AppRouteHandler<typeof applyConsortiumSharedRulesRoute> = async (c) => {
  const session = await resolveAuthenticatedSession(
    c.var.auth as AuthSessionProvider,
    c.req.raw.headers,
  );
  if (!session) {
    return unauthorizedResponse(c);
  }

  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  const { consortiumId } = c.req.valid("param");
  const body = c.req.valid("json");
  try {
    const consortium = await assertConsortiumOwner(
      c.get("schoolApp").repositories,
      consortiumId,
      session.user.id,
    );
    const school = await c.get("schoolApp").repositories.schools.findById(body.schoolId);
    if (!school || school.consortiumId !== consortiumId) {
      throw new BusinessRuleViolationError(
        "SCHOOL_NOT_IN_CONSORTIUM",
        "School is not a member of this school group",
      );
    }
    if (actor.schoolId !== body.schoolId) {
      return forbiddenResponse(c, new BusinessRuleViolationError(
        "SCHOOL_CONTEXT_REQUIRED",
        "Switch to the target school before applying shared rules",
      ));
    }

    const templates = consortium.sharedRules.structureTemplateIds.filter(isStructureTemplateId);
    if (templates.length === 0) {
      throw new BusinessRuleViolationError(
        "NO_SHARED_STRUCTURE_TEMPLATES",
        "Define structure templates on the school group first",
      );
    }

    const result = await applyStructureTemplate(c.get("schoolApp"), actor, {
      templates,
      levels: body.levels,
    });
    return c.json(result, HttpStatusCodes.OK);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};

export const assignConsortiumSchoolOwnerRoute = createRoute({
  method: "post",
  path: schoolApiPath("consortium", "{consortiumId}", "schools", "{schoolId}", "assign-owner"),
  tags: ["Core Consortium"],
  summary: "Assign or transfer a school owner within a school group",
  request: {
    params: z.object({
      consortiumId: z.string().min(1),
      schoolId: z.string().min(1),
    }),
    body: jsonContent(assignSchoolOwnerRequestSchema, "Assign owner payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(assignSchoolOwnerResponseSchema, "Owner assignment result"),
    ...coreRouteErrorResponses,
  },
});

export const assignConsortiumSchoolOwnerHandler: AppRouteHandler<typeof assignConsortiumSchoolOwnerRoute> = async (c) => {
  const session = await resolveAuthenticatedSession(
    c.var.auth as AuthSessionProvider,
    c.req.raw.headers,
  );
  if (!session) {
    return unauthorizedResponse(c);
  }

  const { consortiumId, schoolId } = c.req.valid("param");
  const body = c.req.valid("json");
  const requestId = c.req.header("x-request-id")?.trim() || randomUUID();

  try {
    const result = await assignConsortiumSchoolOwner(c.get("schoolApp"), {
      consortiumId,
      schoolId,
      actorSubjectId: session.user.id,
      requestId,
      inviteBaseUrl: resolveInviteBaseUrl(c.env),
      ...(body.subjectId ? { subjectId: body.subjectId } : {}),
      ...(body.email ? { email: body.email } : {}),
    });
    return c.json(result, HttpStatusCodes.OK);
  }
  catch (error) {
    return routeErrorResponse(c, error);
  }
};
