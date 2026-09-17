import type { AuthenticatedSession } from "@/http/dependencies/session-actor";
import { resolveAuthenticatedSession } from "@/http/dependencies/session-actor";
import { conflictResponse, routeErrorResponse, unauthorizedResponse } from "@/http/responses";
import type { AppRouteHandler } from "@/http/types";
import { applyStructureTemplate, completeOnboardingWizard, inviteStaffMembers, isOnboardingStaffInviteRoleKey, isStructureTemplateId, provisionOnboarding, recordOnboardingAccountProgress, registerSchoolWithOwner, resolveOnboardingAccountStatus } from "@edaya/service";
import type { StructureTemplateDefinition } from "@edaya/service";
import { listStructureTemplatesForCountry, resolveStructureTemplates } from "@edaya/fixtures/onboarding";
import { resolveInviteBaseUrl, shouldAllowPublicSchoolRegistration } from "@/runtime/shared/env/derived";
import { serializeCommandResult } from "@/lib/school-api/dispatch/commands";
import { clientRouteOperation } from "@/lib/school-api/openapi/client-extensions";
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

const structureTemplateReportCardDomainCategorySchema = z.object({
  domain: z.string().trim().min(1),
  label: z.string().trim().min(1),
  order: z.number().int(),
  coefficient: z.number().optional(),
  weight: z.number().optional(),
});

const structureTemplateReportCardSectionSchema = z.object({
  role: z.enum(["subjects", "summary", "comments"]),
  label: z.string().trim().min(1),
  order: z.number().int(),
  subjectCodes: z.array(z.string().trim().min(1)).optional(),
});

const structureTemplateReportCardStructureSchema = z.object({
  gradingScale: z.number(),
  passingGrade: z.number(),
  periods: z.array(z.object({
    code: z.string().trim().min(1),
    name: z.string().trim().min(1),
    weight: z.number(),
  })).min(1),
  domainCategories: z.array(structureTemplateReportCardDomainCategorySchema).optional(),
  sections: z.array(structureTemplateReportCardSectionSchema).optional(),
  includeSummary: z.boolean().optional(),
  includeComments: z.boolean().optional(),
});

const structureTemplateDefinitionSchema = z.object({
  id: z.string().trim().min(1),
  countryCode: z.enum(["CI", "FR"]),
  label: z.string().trim().min(1),
  description: z.string().trim().min(1),
  cycle: z.string().trim().min(1),
  reportCardStructure: structureTemplateReportCardStructureSchema.optional(),
  gradeLevels: z.array(z.object({
    id: z.string().trim().min(1),
    code: z.string().trim().min(1),
    name: z.string().trim().min(1),
    shortLabel: z.string().trim().min(1),
    order: z.number().int(),
    examYear: z.boolean().optional(),
    examName: z.string().trim().min(1).optional(),
    reportCardStructure: structureTemplateReportCardStructureSchema.optional(),
  }).passthrough()).min(1),
  subjects: z.array(z.object({
    code: z.string().trim().min(1),
    shortName: z.string().trim().min(1),
    domain: z.string().trim().min(1),
    defaultCoefficient: z.number(),
  }).passthrough()).min(1),
  curriculum: z.array(z.object({
    levelCode: z.string().trim().min(1),
    subjectCode: z.string().trim().min(1),
    longName: z.string().trim().min(1).optional(),
    coefficient: z.number(),
    matters: z.array(z.string().trim().min(1)).min(1),
  }).passthrough()),
}).passthrough().openapi("StructureTemplateDefinition");

const onboardingListStructureTemplatesQuerySchema = z.object({
  country: z.string().trim().min(1).optional(),
}).openapi("OnboardingListStructureTemplatesQuery");

const onboardingListStructureTemplatesResponseSchema = z.object({
  countryCode: z.enum(["CI", "FR"]),
  templates: z.array(structureTemplateDefinitionSchema),
}).openapi("OnboardingListStructureTemplatesResponse");

const structureTemplateSnapshotSchema = structureTemplateDefinitionSchema;

const classNamingModeSchema = z.enum(["alphabetical", "numerical"]).default("numerical");

const onboardingStructureLevelSchema = z.object({
  gradeLevelId: z.string().trim().min(1),
  classCount: z.number().int().min(1),
  capacity: z.number().int().min(1),
  classNamingMode: classNamingModeSchema.optional(),
});

const onboardingApplyStructureTemplateRequestSchema = z.object({
  templates: z.array(z.string().trim().min(1).refine(isStructureTemplateId, "Invalid structure template id")).min(1),
  templateSnapshots: z.array(structureTemplateSnapshotSchema).optional(),
  levels: z.array(onboardingStructureLevelSchema).min(1),
}).openapi("OnboardingApplyStructureTemplateRequest");

const onboardingApplyStructureTemplateResponseSchema = z.object({
  gradeLevelCount: z.number().int(),
  classGroupCount: z.number().int(),
  subjectCount: z.number().int(),
  classSubjectCount: z.number().int(),
  gradeScaleCount: z.number().int(),
  reportCardDefinitionCount: z.number().int(),
  reportCardSectionCount: z.number().int(),
}).openapi("OnboardingApplyStructureTemplateResponse");

const onboardingStaffInviteRequestSchema = z.object({
  invites: z.array(z.object({
    email: z.string().trim().email(),
    role: z.string().trim().min(1).refine(isOnboardingStaffInviteRoleKey, "Invalid staff invite role"),
  })),
}).openapi("OnboardingInviteStaffMembersRequest");

const onboardingStaffInviteResponseSchema = z.object({
  invitedCount: z.number().int(),
  permissionAssignmentsEnsured: z.number().int(),
}).openapi("OnboardingInviteStaffMembersResponse");

const onboardingAccountStatusSchema = z.object({
  wizardCompleted: z.boolean(),
  maxReachedStep: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  schoolStepSubmitted: z.boolean(),
  structureStepSubmitted: z.boolean(),
}).openapi("OnboardingAccountStatusResponse");

const onboardingCompleteWizardRequestSchema = z.object({
  maxReachedStep: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
}).openapi("OnboardingCompleteWizardRequest");

const onboardingProvisionRequestSchema = z.object({
  schoolId: z.string().uuid(),
  requestId: z.string().uuid(),
  school: z.object({
    name: z.string().trim().min(1),
    timeZone: z.string().trim().min(1),
    city: z.string().trim().min(1),
    country: z.string().trim().min(1),
    academicYearLabel: z.string().trim().min(1),
    academicYearStart: z.string().trim().min(1),
    academicYearEnd: z.string().trim().min(1),
    periodType: z.enum(["trimester", "semester"]),
    periods: z.array(z.object({
      label: z.string().trim().min(1),
      start: z.string().trim().min(1),
      end: z.string().trim().min(1),
    })).min(1),
  }),
  structure: z.object({
    templates: z.array(z.string().trim().min(1).refine(isStructureTemplateId, "Invalid structure template id")).min(1),
    levels: z.array(onboardingStructureLevelSchema).min(1),
  }),
  invites: z.array(z.object({
    email: z.string().trim().email(),
    role: z.string().trim().min(1).refine(isOnboardingStaffInviteRoleKey, "Invalid staff invite role"),
  })).optional(),
}).openapi("OnboardingProvisionRequest");

const onboardingProvisionResponseSchema = z.object({
  schoolId: z.string(),
  yearId: z.string(),
  periodId: z.string(),
  structure: onboardingApplyStructureTemplateResponseSchema.nullable(),
  staff: onboardingStaffInviteResponseSchema,
  status: onboardingAccountStatusSchema,
  phases: z.array(z.object({
    phase: z.string(),
    ms: z.number(),
  })),
  replayed: z.boolean().optional(),
}).openapi("OnboardingProvisionResponse");

export const onboardingRegisterSchoolRoute = createRoute({
  method: "post",
  path: schoolApiPath("onboarding", "register-school"),
  tags: ["Core Onboarding"],
  summary: "Register a school and make the current user its owner (dev bootstrap)",
  ...clientRouteOperation({
    namespace: "onboarding",
    clientKey: "registerSchool",
    path: "onboarding/register-school",
    requestSchemaName: "OnboardingRegisterSchoolRequest",
    responseSchemaName: "School",
  }),
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
    c.req.raw.headers,
    c.var.identityClient,
  );
  if (!session) {
    return unauthorizedResponse(c);
  }

  const body = c.req.valid("json");
  if (c.get("actor")) {
    return conflictResponse(c, new BusinessRuleViolationError(
      "SUBJECT_ALREADY_LINKED",
      "This account is already linked to a school actor",
    ));
  }

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

export const onboardingListStructureTemplatesRoute = createRoute({
  method: "get",
  path: schoolApiPath("onboarding", "structure-templates"),
  tags: ["Core Onboarding"],
  summary: "List built-in school structure templates for a country",
  ...clientRouteOperation({
    namespace: "onboarding",
    clientKey: "listStructureTemplates",
    path: "onboarding/structure-templates",
    responseSchemaName: "OnboardingListStructureTemplatesResponse",
  }),
  request: {
    query: onboardingListStructureTemplatesQuerySchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(onboardingListStructureTemplatesResponseSchema, "Structure templates for the requested country"),
    ...coreRouteErrorResponses,
  },
});

export const onboardingListStructureTemplatesHandler: AppRouteHandler<typeof onboardingListStructureTemplatesRoute> = async (c) => {
  const query = c.req.valid("query");
  const result = listStructureTemplatesForCountry(query.country);
  return c.json({
    countryCode: result.countryCode,
    templates: [...result.templates],
  }, HttpStatusCodes.OK);
};

export const onboardingApplyStructureTemplateRoute = createRoute({
  method: "post",
  path: schoolApiPath("onboarding", "apply-structure-template"),
  tags: ["Core Onboarding"],
  summary: "Apply collège / lycée structure template for the current school",
  ...clientRouteOperation({
    namespace: "onboarding",
    clientKey: "applyStructureTemplate",
    path: "onboarding/apply-structure-template",
    requestSchemaName: "OnboardingApplyStructureTemplateRequest",
    responseSchemaName: "OnboardingApplyStructureTemplateResponse",
  }),
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
    const result = await applyStructureTemplate(c.get("schoolApp"), actor, {
      templates: body.templates,
      templateSnapshots: resolveStructureTemplates(
        body.templates,
        (body.templateSnapshots as StructureTemplateDefinition[] | undefined) ?? [],
      ),
      levels: body.levels,
    });
    await recordOnboardingAccountProgress(c.get("schoolApp").repositories, actor, {
      maxReachedStep: 3,
    });
    const { phases: _phases, ...summary } = result;
    return c.json(summary, HttpStatusCodes.OK);
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
  ...clientRouteOperation({
    namespace: "onboarding",
    clientKey: "inviteStaffMembers",
    path: "onboarding/invite-staff-members",
    requestSchemaName: "OnboardingInviteStaffMembersRequest",
    responseSchemaName: "OnboardingInviteStaffMembersResponse",
  }),
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
    await recordOnboardingAccountProgress(c.get("schoolApp").repositories, actor, {
      maxReachedStep: 3,
    });
    return c.json(result, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};

export const onboardingAccountStatusRoute = createRoute({
  method: "get",
  path: schoolApiPath("onboarding", "account-status"),
  tags: ["Core Onboarding"],
  summary: "Get onboarding progress for the current staff account",
  ...clientRouteOperation({
    namespace: "onboarding",
    clientKey: "accountStatus",
    path: "onboarding/account-status",
    responseSchemaName: "OnboardingAccountStatusResponse",
  }),
  responses: {
    [HttpStatusCodes.OK]: jsonContent(onboardingAccountStatusSchema, "Onboarding account status"),
    ...coreRouteErrorResponses,
  },
});

export const onboardingAccountStatusHandler: AppRouteHandler<typeof onboardingAccountStatusRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  try {
    const status = await resolveOnboardingAccountStatus(c.get("schoolApp").repositories, actor);
    return c.json(status, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};

export const onboardingCompleteWizardRoute = createRoute({
  method: "post",
  path: schoolApiPath("onboarding", "complete-wizard"),
  tags: ["Core Onboarding"],
  summary: "Mark the onboarding wizard complete for the current staff account",
  ...clientRouteOperation({
    namespace: "onboarding",
    clientKey: "completeWizard",
    path: "onboarding/complete-wizard",
    requestSchemaName: "OnboardingCompleteWizardRequest",
    responseSchemaName: "OnboardingAccountStatusResponse",
  }),
  request: {
    body: jsonContent(onboardingCompleteWizardRequestSchema, "Optional onboarding completion payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(onboardingAccountStatusSchema, "Updated onboarding account status"),
    ...coreRouteErrorResponses,
  },
});

export const onboardingCompleteWizardHandler: AppRouteHandler<typeof onboardingCompleteWizardRoute> = async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return unauthorizedResponse(c);
  }

  try {
    const status = await completeOnboardingWizard(c.get("schoolApp").repositories, actor);
    return c.json(status, HttpStatusCodes.OK);
  }
  catch (err) {
    return routeErrorResponse(c, err);
  }
};

export const onboardingProvisionRoute = createRoute({
  method: "post",
  path: schoolApiPath("onboarding", "provision"),
  tags: ["Core Onboarding"],
  summary: "Provision a school from the full onboarding draft in one batch",
  ...clientRouteOperation({
    namespace: "onboarding",
    clientKey: "provision",
    path: "onboarding/provision",
    requestSchemaName: "OnboardingProvisionRequest",
    responseSchemaName: "OnboardingProvisionResponse",
  }),
  request: {
    body: jsonContent(onboardingProvisionRequestSchema, "Full onboarding draft payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(onboardingProvisionResponseSchema, "Provisioned school summary"),
    [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(commandMessageSchema, "Public school registration is disabled"),
    ...coreRouteErrorResponses,
  },
});

export const onboardingProvisionHandler: AppRouteHandler<typeof onboardingProvisionRoute> = async (c) => {
  const session = await resolveAuthenticatedSession(
    c.req.raw.headers,
    c.var.identityClient,
  );
  if (!session) {
    return unauthorizedResponse(c);
  }

  const body = c.req.valid("json");
  const allowPublicSchoolRegistration = shouldAllowPublicSchoolRegistration(c.env);

  try {
    const result = await provisionOnboarding(
      c.get("schoolApp"),
      session,
      {
        schoolId: body.schoolId,
        requestId: body.requestId,
        school: body.school,
        structure: {
          ...body.structure,
          templateSnapshots: resolveStructureTemplates(body.structure.templates),
        },
        ...(body.invites ? { invites: body.invites } : {}),
      },
      {
        requestId: body.requestId,
        existingActor: c.get("actor") ?? undefined,
        inviteBaseUrl: resolveInviteBaseUrl(c.env),
        allowPublicSchoolRegistration,
      },
    );
    const { structure, ...rest } = result;
    return c.json({
      ...rest,
      structure: structure
        ? {
            gradeLevelCount: structure.gradeLevelCount,
            classGroupCount: structure.classGroupCount,
            subjectCount: structure.subjectCount,
            classSubjectCount: structure.classSubjectCount,
            gradeScaleCount: structure.gradeScaleCount,
            reportCardDefinitionCount: structure.reportCardDefinitionCount,
            reportCardSectionCount: structure.reportCardSectionCount,
          }
        : null,
    }, HttpStatusCodes.OK);
  }
  catch (err) {
    if (
      err instanceof BusinessRuleViolationError
      && err.code === "PUBLIC_SCHOOL_REGISTRATION_DISABLED"
    ) {
      return c.json(
        { message: "Public school registration is disabled" },
        HttpStatusCodes.SERVICE_UNAVAILABLE,
      );
    }
    return routeErrorResponse(c, err);
  }
};

function toOwnerSession(session: AuthenticatedSession) {
  return {
    user: {
      id: session.user.id,
      emailVerified: session.user.emailVerified,
      ...(session.user.email ? { email: session.user.email } : {}),
      ...(session.user.name ? { name: session.user.name } : {}),
    },
  };
}
