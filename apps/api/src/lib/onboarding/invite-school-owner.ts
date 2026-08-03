import type { ApiSchoolApplication } from "@/lib/school-api/application";
import type { ActorMetadata } from "@edaya/authorization";
import {
  AccountInvitationContactChannel,
  AccountInvitationKind,
  BusinessRuleViolationError,
  School as SchoolEntity,
} from "@edaya/core";
import {
  AuthorizationError,
  AuthorizationErrorCode,
  createBootstrapStaffActorMetadata,
} from "@edaya/authorization";
import { randomUUID } from "node:crypto";

export interface InviteSchoolOwnerInput {
  email: string;
  inviteBaseUrl: string;
}

export interface InviteSchoolOwnerResult {
  staffId: string;
  invitationSent: boolean;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(email);
}

function namesFromInviteEmail(email: string): { firstName: string; lastName: string } {
  const local = email.split("@")[0] ?? "invite";
  const parts = local.replace(/[._+-]+/g, " ").split(/\s+/).filter(Boolean);
  const capitalize = (value: string) =>
    value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

  if (parts.length >= 2) {
    return {
      firstName: capitalize(parts[0]!),
      lastName: capitalize(parts.slice(1).join(" ")),
    };
  }

  return {
    firstName: capitalize(parts[0] ?? "Invité"),
    lastName: "—",
  };
}

export async function assertEmailNotAlreadySchoolOwner(
  application: ApiSchoolApplication,
  email: string,
  exceptSchoolId?: string,
): Promise<void> {
  const normalized = normalizeEmail(email);
  const schools = await application.repositories.schools.list();

  for (const school of schools) {
    if (exceptSchoolId && school.id === exceptSchoolId) {
      continue;
    }

    if (school.ownerSubjectId) {
      const ownerStaff = await application.repositories.staffMembers.findOne({
        subjectId: school.ownerSubjectId,
        schoolId: school.id,
      });
      if (ownerStaff?.email?.trim().toLowerCase() === normalized) {
        throw new BusinessRuleViolationError(
          "OWNER_EMAIL_ALREADY_ASSIGNED",
          "This email is already the owner of another school",
        );
      }
    }

    if (school.pendingOwnerStaffId) {
      const pendingStaff = await application.repositories.staffMembers.findById(
        school.pendingOwnerStaffId,
      );
      if (pendingStaff?.email?.trim().toLowerCase() === normalized) {
        throw new BusinessRuleViolationError(
          "OWNER_EMAIL_ALREADY_PENDING",
          "This email is already invited as owner of another school",
        );
      }
    }
  }
}

function createElevatedInviteActor(
  actor: Extract<ActorMetadata, { kind: "staff" }>,
): ActorMetadata {
  return createBootstrapStaffActorMetadata({
    schoolId: actor.schoolId,
    requestId: actor.requestId ?? randomUUID(),
    staffMemberId: actor.staffMemberId,
    subjectId: actor.subjectId,
  });
}

/**
 * Creates (or reuses) an unlinked staff member, marks them as pending school owner,
 * and sends a staff account invitation. Ownership is applied when the invite is accepted.
 */
export async function inviteSchoolOwner(
  application: ApiSchoolApplication,
  actor: ActorMetadata,
  input: InviteSchoolOwnerInput,
): Promise<InviteSchoolOwnerResult> {
  if (actor.kind !== "staff") {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden, "Staff actor required");
  }

  const email = normalizeEmail(input.email);
  if (!email || !isValidEmail(email)) {
    throw new BusinessRuleViolationError(
      "OWNER_INVITE_INVALID_EMAIL",
      `Invalid email address: ${input.email}`,
    );
  }

  if (!input.inviteBaseUrl) {
    throw new BusinessRuleViolationError(
      "INVITE_BASE_URL_MISSING",
      "Invitation links are not configured for this environment",
    );
  }

  const schoolId = actor.schoolId;
  const school = await application.repositories.schools.findById(schoolId);
  if (!school) {
    throw new BusinessRuleViolationError("SCHOOL_NOT_FOUND", "School not found");
  }

  await assertEmailNotAlreadySchoolOwner(application, email, schoolId);

  const existingStaff = (await application.repositories.staffMembers.list({ schoolId }))
    .find(member => member.email?.trim().toLowerCase() === email);

  if (existingStaff?.subjectId) {
    throw new BusinessRuleViolationError(
      "OWNER_INVITE_ALREADY_LINKED",
      "This email already belongs to a linked staff member; assign them by subjectId instead",
    );
  }

  const elevatedActor = createElevatedInviteActor(actor);
  const service = application.forActor(elevatedActor);
  const { firstName, lastName } = namesFromInviteEmail(email);
  const staffId = existingStaff?.id ?? randomUUID();

  if (!existingStaff) {
    await service.setupWorkflow.registerStaffMember({
      id: staffId,
      schoolId,
      firstName,
      lastName,
      email,
      isActive: true,
      sendAccountInvitation: false,
    });
  }

  await application.repositories.schools.save(new SchoolEntity({
    ...school.data,
    pendingOwnerStaffId: staffId,
  }));

  await service.accountInvitationWorkflow.sendAccountInvitation({
    kind: AccountInvitationKind.Staff,
    targetId: staffId,
    contactChannel: AccountInvitationContactChannel.Email,
    inviteBaseUrl: input.inviteBaseUrl,
  });

  return { staffId, invitationSent: true };
}
