import type { ApiSchoolApplication } from "@/lib/school-api/application";
import { BusinessRuleViolationError } from "@edaya/core";
import { createBootstrapStaffActorMetadata } from "@edaya/authorization";
import type { School, SchoolType } from "@edaya/core";
import type { SchoolRepositories } from "@edaya/service";
import { randomUUID } from "node:crypto";
import { assertConsortiumOwner } from "@/lib/consortium/consortium-service";
import { inviteSchoolOwner } from "@/lib/onboarding/invite-school-owner";

export interface RegisterSchoolOwnerSession {
  user: {
    id: string;
    email?: string;
    name?: string;
  };
}

export interface RegisterSchoolWithOwnerInput {
  name: string;
  timeZone: string;
  type?: SchoolType;
  country?: string;
  city?: string;
  requestId: string;
  id?: string;
  ownerStaffId?: string;
  ownerFirstName?: string;
  ownerLastName?: string;
  ownerEmail?: string;
  consortiumId?: string;
  /** When false, caller is linked as elevated staff via consortium but not school owner. */
  assignAsSchoolOwner?: boolean;
  /** Invite this email as designated school owner (forces assignAsSchoolOwner=false). */
  ownerInviteEmail?: string;
  inviteBaseUrl?: string;
}

export interface RegisterSchoolWithOwnerResult {
  school: School;
}

export async function assertSubjectUnlinked(
  repositories: SchoolRepositories,
  subjectId: string,
): Promise<void> {
  const [staff, guardian, student] = await Promise.all([
    repositories.staffMembers.findOne({ subjectId }),
    repositories.guardians.findOne({ subjectId }),
    repositories.students.findOne({ subjectId }),
  ]);

  if (staff || guardian || student) {
    throw new BusinessRuleViolationError(
      "SUBJECT_ALREADY_LINKED",
      "This account is already linked to a school actor",
    );
  }
}

export function resolveOwnerProfile(session: RegisterSchoolOwnerSession): {
  firstName: string;
  lastName: string;
  email?: string;
} {
  const parsed = parseDisplayName(session.user.name);
  const firstName = parsed.firstName || "Owner";
  const lastName = parsed.lastName || "Account";
  const email = session.user.email?.trim();

  return {
    firstName,
    lastName,
    ...(email ? { email } : {}),
  };
}

export async function registerSchoolWithOwner(
  application: ApiSchoolApplication,
  session: RegisterSchoolOwnerSession,
  input: RegisterSchoolWithOwnerInput,
): Promise<RegisterSchoolWithOwnerResult> {
  const subjectId = session.user.id;
  const existingStaff = await application.repositories.staffMembers.findOne({ subjectId });

  if (input.consortiumId) {
    await assertConsortiumOwner(application.repositories, input.consortiumId, subjectId);
  }

  if (!existingStaff) {
    await assertSubjectUnlinked(application.repositories, subjectId);
  }
  else if (!input.consortiumId) {
    throw new BusinessRuleViolationError(
      "SUBJECT_ALREADY_LINKED",
      "This account is already linked to a school actor",
    );
  }
  else {
    const alreadyInSchool = await application.repositories.staffMembers.findOne({
      subjectId,
      schoolId: input.id,
    });
    if (alreadyInSchool) {
      throw new BusinessRuleViolationError(
        "SUBJECT_ALREADY_LINKED",
        "This account is already linked to this school",
      );
    }
  }

  const schoolId = input.id ?? randomUUID();
  const ownerInviteEmail = input.ownerInviteEmail?.trim().toLowerCase();
  if (ownerInviteEmail && !input.consortiumId) {
    throw new BusinessRuleViolationError(
      "OWNER_INVITE_REQUIRES_CONSORTIUM",
      "Owner invitation at registration is only available for schools in a school group",
    );
  }

  const assignAsSchoolOwner = ownerInviteEmail
    ? false
    : (input.assignAsSchoolOwner ?? !existingStaff);
  const owner = input.ownerFirstName && input.ownerLastName
    ? {
        firstName: input.ownerFirstName,
        lastName: input.ownerLastName,
        ...(input.ownerEmail ? { email: input.ownerEmail } : {}),
      }
    : resolveOwnerProfile(session);

  const callerStaffId = input.ownerStaffId ?? randomUUID();
  const actor = createBootstrapStaffActorMetadata({
    schoolId,
    requestId: input.requestId,
    staffMemberId: callerStaffId,
    subjectId,
  });
  const service = application.forActor(actor);

  const school = await service.setupWorkflow.registerSchool({
    id: schoolId,
    name: input.name,
    timeZone: input.timeZone,
    ...(assignAsSchoolOwner ? { ownerSubjectId: subjectId } : {}),
    ...(input.consortiumId ? { consortiumId: input.consortiumId } : {}),
    ...(input.type ? { type: input.type } : {}),
    ...(input.country ? { country: input.country } : {}),
    ...(input.city ? { city: input.city } : {}),
  });

  const existingStaffInSchool = await application.repositories.staffMembers.findOne({
    subjectId,
    schoolId,
  });
  if (!existingStaffInSchool) {
    await service.setupWorkflow.registerStaffMember({
      id: callerStaffId,
      schoolId,
      firstName: owner.firstName,
      lastName: owner.lastName,
      subjectId,
      ...(owner.email ? { email: owner.email } : {}),
    });
  }

  if (ownerInviteEmail) {
    if (!input.inviteBaseUrl) {
      throw new BusinessRuleViolationError(
        "INVITE_BASE_URL_MISSING",
        "Invitation links are not configured for this environment",
      );
    }
    const inviteActor = createBootstrapStaffActorMetadata({
      schoolId,
      requestId: input.requestId,
      staffMemberId: existingStaffInSchool?.id ?? callerStaffId,
      subjectId,
    });
    await inviteSchoolOwner(application, inviteActor, {
      email: ownerInviteEmail,
      inviteBaseUrl: input.inviteBaseUrl,
    });
  }

  const persistedSchool = await application.repositories.schools.findById(schoolId);
  if (assignAsSchoolOwner && !persistedSchool?.ownerSubjectId) {
    throw new BusinessRuleViolationError(
      "ONBOARDING_OWNER_ASSIGNMENT_FAILED",
      "Failed to assign the caller as school owner",
    );
  }
  if (ownerInviteEmail && !persistedSchool?.pendingOwnerStaffId) {
    throw new BusinessRuleViolationError(
      "ONBOARDING_OWNER_INVITE_FAILED",
      "Failed to invite the designated school owner",
    );
  }

  return { school: persistedSchool ?? school };
}

function parseDisplayName(name: string | undefined): { firstName?: string; lastName?: string } {
  const trimmed = name?.trim();
  if (!trimmed) {
    return {};
  }

  const [firstName, ...rest] = trimmed.split(/\s+/);
  const lastName = rest.join(" ").trim();
  return {
    firstName,
    ...(lastName ? { lastName } : {}),
  };
}
