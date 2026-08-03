import type { ApiSchoolApplication } from "@/lib/school-api/application";
import type { AuthenticatedSession } from "@/http/dependencies/session-actor";
import { createBootstrapStaffActorMetadata } from "@edaya/authorization";
import type { ActorMetadata } from "@edaya/authorization";
import { BusinessRuleViolationError } from "@edaya/core";
import { isStructureTemplateId } from "@edaya/fixtures/onboarding";
import type { StructureTemplateId } from "@edaya/fixtures/onboarding";
import { randomUUID } from "node:crypto";
import { applyStructureTemplate } from "./apply-structure-template";
import type { ApplyStructureTemplateResult } from "./apply-structure-template";
import { completeOnboardingWizard } from "./onboarding-account-state";
import type { OnboardingAccountStatus } from "./onboarding-account-state";
import { ensureAcademicStructureFromDraft } from "./ensure-academic-structure-from-draft";
import { inviteStaffMembers } from "./invite-staff-members";
import type { InviteStaffMembersResult } from "./invite-staff-members";
import { isOnboardingStaffInviteRoleKey } from "./staff-invite-roles";
import type { OnboardingStaffInviteRoleKey } from "./staff-invite-roles";
import { registerSchoolWithOwner } from "./register-school-with-owner";

export interface ProvisionOnboardingSchoolInput {
  name: string;
  timeZone: string;
  city: string;
  country: string;
  academicYearLabel: string;
  academicYearStart: string;
  academicYearEnd: string;
  periodType: "trimester" | "semester";
  periods: Array<{
    label: string;
    start: string;
    end: string;
  }>;
}

export interface ProvisionOnboardingStructureInput {
  templates: string[];
  levels: Array<{
    gradeLevelId: string;
    classCount: number;
    capacity: number;
    classNamingMode?: "alphabetical" | "numerical";
  }>;
}

export interface ProvisionOnboardingInviteInput {
  email: string;
  role: string;
}

export interface ProvisionOnboardingInput {
  school: ProvisionOnboardingSchoolInput;
  structure: ProvisionOnboardingStructureInput;
  invites?: ProvisionOnboardingInviteInput[];
}

export interface ProvisionOnboardingResult {
  schoolId: string;
  yearId: string;
  periodId: string;
  structure: ApplyStructureTemplateResult | null;
  staff: InviteStaffMembersResult;
  status: OnboardingAccountStatus;
  phases: Array<{ phase: string; ms: number }>;
}

function toOwnerSession(session: AuthenticatedSession) {
  return {
    user: {
      id: session.user.id,
      ...(session.user.email ? { email: session.user.email } : {}),
      ...(session.user.name ? { name: session.user.name } : {}),
    },
  };
}

function parseTemplates(templates: string[]): StructureTemplateId[] {
  if (!templates.length) {
    throw new BusinessRuleViolationError(
      "STRUCTURE_TEMPLATE_REQUIRED",
      "At least one school template must be selected",
    );
  }
  const parsed: StructureTemplateId[] = [];
  for (const template of templates) {
    if (!isStructureTemplateId(template)) {
      throw new BusinessRuleViolationError(
        "STRUCTURE_TEMPLATE_INVALID",
        `Invalid structure template id: ${template}`,
      );
    }
    parsed.push(template);
  }
  return parsed;
}

function parseInvites(invites: ProvisionOnboardingInviteInput[] | undefined): Array<{
  email: string;
  role: OnboardingStaffInviteRoleKey;
}> {
  if (!invites?.length) {
    return [];
  }
  return invites.map((invite) => {
    if (!isOnboardingStaffInviteRoleKey(invite.role)) {
      throw new BusinessRuleViolationError(
        "STAFF_INVITE_INVALID_ROLE",
        `Invalid staff invite role: ${invite.role}`,
      );
    }
    return {
      email: invite.email.trim().toLowerCase(),
      role: invite.role,
    };
  });
}

async function resolveOwnerActorAfterRegister(
  application: ApiSchoolApplication,
  session: AuthenticatedSession,
  schoolId: string,
  requestId: string,
): Promise<ActorMetadata> {
  const staff = await application.repositories.staffMembers.findOne({
    subjectId: session.user.id,
    schoolId,
  });
  if (!staff) {
    throw new BusinessRuleViolationError(
      "ONBOARDING_OWNER_STAFF_MISSING",
      "Owner staff member was not found after school registration",
    );
  }
  return createBootstrapStaffActorMetadata({
    schoolId,
    requestId,
    staffMemberId: staff.id,
    subjectId: session.user.id,
  });
}

export async function provisionOnboarding(
  application: ApiSchoolApplication,
  session: AuthenticatedSession,
  input: ProvisionOnboardingInput,
  options: {
    requestId?: string;
    existingActor?: ActorMetadata;
    inviteBaseUrl?: string;
    allowPublicSchoolRegistration: boolean;
  },
): Promise<ProvisionOnboardingResult> {
  const requestId = options.requestId ?? randomUUID();
  const phases: Array<{ phase: string; ms: number }> = [];

  const track = async <T>(
    phase: string,
    run: () => Promise<T>,
  ): Promise<T> => {
    const phaseStarted = performance.now();
    try {
      return await run();
    }
    finally {
      phases.push({ phase, ms: performance.now() - phaseStarted });
    }
  };

  const templates = parseTemplates(input.structure.templates);
  const invites = parseInvites(input.invites);

  let schoolId: string;
  let actor: ActorMetadata;

  if (options.existingActor?.kind === "staff" && options.existingActor.schoolId) {
    schoolId = options.existingActor.schoolId;
    actor = createBootstrapStaffActorMetadata({
      schoolId,
      requestId,
      staffMemberId: options.existingActor.staffMemberId,
      subjectId: options.existingActor.subjectId,
    });
  }
  else {
    if (!options.allowPublicSchoolRegistration) {
      throw new BusinessRuleViolationError(
        "PUBLIC_SCHOOL_REGISTRATION_DISABLED",
        "Public school registration is disabled",
      );
    }
    try {
      const registered = await track("registerSchool", async () => {
        return registerSchoolWithOwner(application, toOwnerSession(session), {
          name: input.school.name,
          timeZone: input.school.timeZone,
          city: input.school.city,
          country: input.school.country,
          requestId,
        });
      });
      schoolId = registered.school.id;
      actor = await track("resolveOwnerActor", async () => {
        return resolveOwnerActorAfterRegister(application, session, schoolId, requestId);
      });
    }
    catch (error) {
      if (
        !(error instanceof BusinessRuleViolationError)
        || error.code !== "SUBJECT_ALREADY_LINKED"
      ) {
        throw error;
      }
      const existingStaff = await application.repositories.staffMembers.findOne({
        subjectId: session.user.id,
      });
      if (!existingStaff) {
        throw error;
      }
      schoolId = existingStaff.schoolId;
      actor = await track("resolveOwnerActor", async () => {
        return resolveOwnerActorAfterRegister(application, session, schoolId, requestId);
      });
    }
  }

  const academic = await track("ensureAcademicStructure", async () => {
    return ensureAcademicStructureFromDraft(application, actor, {
      schoolId,
      academicYearLabel: input.school.academicYearLabel,
      academicYearStart: input.school.academicYearStart,
      academicYearEnd: input.school.academicYearEnd,
      periodType: input.school.periodType,
      periods: input.school.periods,
    });
  });

  let structure: ApplyStructureTemplateResult | null = null;
  try {
    structure = await track("applyStructureTemplate", async () => {
      return applyStructureTemplate(application, actor, {
        templates,
        levels: input.structure.levels,
      });
    });
  }
  catch (error) {
    if (
      error instanceof BusinessRuleViolationError
      && error.code === "STRUCTURE_ALREADY_CONFIGURED"
    ) {
      structure = null;
    }
    else {
      throw error;
    }
  }

  let staff: InviteStaffMembersResult = { invitedCount: 0, permissionAssignmentsEnsured: 0 };
  if (invites.length > 0) {
    staff = await track("inviteStaffMembers", async () => {
      return inviteStaffMembers(application, actor, { invites }, {
        inviteBaseUrl: options.inviteBaseUrl,
      });
    });
  }

  const status = await track("completeWizard", async () => {
    return completeOnboardingWizard(application.repositories, actor);
  });

  return {
    schoolId,
    yearId: academic.yearId,
    periodId: academic.periodId,
    structure,
    staff,
    status,
    phases,
  };
}
