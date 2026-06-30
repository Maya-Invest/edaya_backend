import type { ApiSchoolApplication } from "@/lib/school-api/application";
import type { ActorMetadata } from "@edaya/core";
import {
  AccountInvitationContactChannel,
  AccountInvitationKind,
  AuthorizationError,
  AuthorizationErrorCode,
  BusinessRuleViolationError,
  createBootstrapStaffActorMetadata,
  Permission,
  permissionAction,
  StaffMember,
  StaffRoleAssignment,
} from "@edaya/core";
import { randomUUID } from "node:crypto";
import { ensureDefaultAccessRoles } from "./default-access-roles";
import {
  ACCESS_ROLE_ID_BY_INVITE_ROLE,
  isOnboardingStaffInviteRoleKey,
  type OnboardingStaffInviteRoleKey,
} from "./staff-invite-roles";

export interface InviteStaffMemberInput {
  email: string;
  role: OnboardingStaffInviteRoleKey;
}

export interface InviteStaffMembersInput {
  invites: InviteStaffMemberInput[];
}

export interface InviteStaffMembersOptions {
  inviteBaseUrl?: string;
}

export interface InviteStaffMembersResult {
  invitedCount: number;
  accessRolesEnsured: number;
}

function parseInvites(input: InviteStaffMembersInput): InviteStaffMemberInput[] {
  const normalized: InviteStaffMemberInput[] = [];
  const seenEmails = new Set<string>();

  for (const invite of input.invites) {
    const email = invite.email.trim().toLowerCase();
    if (!email) {
      continue;
    }

    if (!/^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(email)) {
      throw new BusinessRuleViolationError(
        "STAFF_INVITE_INVALID_EMAIL",
        `Invalid email address: ${invite.email}`,
      );
    }

    if (!isOnboardingStaffInviteRoleKey(invite.role)) {
      throw new BusinessRuleViolationError(
        "STAFF_INVITE_INVALID_ROLE",
        `Invalid staff invite role: ${invite.role}`,
      );
    }

    if (seenEmails.has(email)) {
      throw new BusinessRuleViolationError(
        "STAFF_INVITE_DUPLICATE_EMAIL",
        `Duplicate invitation email: ${email}`,
      );
    }

    seenEmails.add(email);
    normalized.push({ email, role: invite.role });
  }

  return normalized;
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

async function assertCanManageOnboardingInvites(
  application: ApiSchoolApplication,
  actor: Extract<ActorMetadata, { kind: "staff" }>,
): Promise<void> {
  const staff = await application.repositories.staffMembers.findOne({
    subjectId: actor.subjectId,
    schoolId: actor.schoolId,
  });
  if (!staff?.isActive) {
    throw new AuthorizationError(
      AuthorizationErrorCode.Forbidden,
      "Active staff membership required to send onboarding invitations",
    );
  }

  const school = await application.repositories.schools.findById(actor.schoolId);
  if (school?.ownerSubjectId === actor.subjectId) {
    return;
  }

  // Onboarding owner before access roles are assigned (same pattern as apply-structure-template).
  const roleAssignments = await application.repositories.staffRoleAssignments.list({
    schoolId: actor.schoolId,
    staffId: staff.id,
    status: "active",
  });
  if (roleAssignments.length === 0) {
    return;
  }

  permissionAction(Permission.ACCESS_CONTROL_ASSIGN)(actor);
}

async function rejectOwnerEmailInvites(
  application: ApiSchoolApplication,
  schoolId: string,
  invites: InviteStaffMemberInput[],
  actor: Extract<ActorMetadata, { kind: "staff" }>,
): Promise<void> {
  const blockedEmails = new Set<string>();

  const callerStaff = await application.repositories.staffMembers.findById(actor.staffMemberId);
  const callerEmail = callerStaff?.email?.trim().toLowerCase();
  if (callerEmail) {
    blockedEmails.add(callerEmail);
  }

  const school = await application.repositories.schools.findById(schoolId);
  if (school?.ownerSubjectId) {
    const ownerStaff = await application.repositories.staffMembers.findOne({
      subjectId: school.ownerSubjectId,
      schoolId,
    });
    const ownerEmail = ownerStaff?.email?.trim().toLowerCase();
    if (ownerEmail) {
      blockedEmails.add(ownerEmail);
    }
  }

  for (const invite of invites) {
    if (blockedEmails.has(invite.email)) {
      throw new BusinessRuleViolationError(
        "STAFF_INVITE_OWNER_EMAIL",
        "You cannot invite the school owner account",
      );
    }
  }
}
function createOnboardingInviteActor(actor: Extract<ActorMetadata, { kind: "staff" }>): ActorMetadata {
  return createBootstrapStaffActorMetadata({
    schoolId: actor.schoolId,
    requestId: actor.requestId ?? randomUUID(),
    staffMemberId: actor.staffMemberId,
    subjectId: actor.subjectId,
  });
}

export async function inviteStaffMembers(
  application: ApiSchoolApplication,
  actor: ActorMetadata,
  input: InviteStaffMembersInput,
  options: InviteStaffMembersOptions = {},
): Promise<InviteStaffMembersResult> {
  const invites = parseInvites(input);
  if (!invites.length) {
    return { invitedCount: 0, accessRolesEnsured: 0 };
  }

  if (actor.kind !== "staff") {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden, "Staff actor required");
  }

  await assertCanManageOnboardingInvites(application, actor);
  await rejectOwnerEmailInvites(application, actor.schoolId, invites, actor);

  if (!options.inviteBaseUrl) {
    throw new BusinessRuleViolationError(
      "INVITE_BASE_URL_MISSING",
      "Invitation links are not configured for this environment",
    );
  }

  const schoolId = actor.schoolId;
  const elevatedActor = createOnboardingInviteActor(actor);
  const service = application.forActor(elevatedActor);

  const academicYears = await application.repositories.academicYears.list({ schoolId });
  const academicYear = academicYears.find(year => year.isActive) ?? academicYears[0];

  let accessRolesEnsured = 0;
  let invitedCount = 0;

  await service.baseService.atomicExecution.execute(async () => {
    const beforeRoles = await application.repositories.accessRoles.list({ schoolId });
    await ensureDefaultAccessRoles(application, elevatedActor);
    const afterRoles = await application.repositories.accessRoles.list({ schoolId });
    accessRolesEnsured = afterRoles.length - beforeRoles.length;

    for (const invite of invites) {
      const { firstName, lastName } = namesFromInviteEmail(invite.email);
      const staffId = randomUUID();
      const accessRoleId = ACCESS_ROLE_ID_BY_INVITE_ROLE[invite.role];

      await service.baseService.entities.staffMembers.save(new StaffMember({
        id: staffId,
        schoolId,
        firstName,
        lastName,
        email: invite.email,
        isActive: true,
        accountKind: "human",
      }), { moduleChecked: true });

      await service.baseService.entities.staffRoleAssignments.save(new StaffRoleAssignment({
        id: randomUUID(),
        staffId,
        schoolId,
        ...(academicYear ? { academicYearId: academicYear.id } : {}),
        roleIds: [accessRoleId],
        scopeGrants: [],
        status: "active",
      }), { moduleChecked: true });

      await service.accountInvitationWorkflow.sendAccountInvitation({
        kind: AccountInvitationKind.Staff,
        targetId: staffId,
        contactChannel: AccountInvitationContactChannel.Email,
        inviteBaseUrl: options.inviteBaseUrl!,
      });

      invitedCount += 1;
    }
  });

  return { invitedCount, accessRolesEnsured };
}
