import type { ApiSchoolApplication } from "@/lib/school-api/application";
import { BusinessRuleViolationError } from "@edaya/core";
import { createBootstrapStaffActorMetadata } from "@edaya/authorization";
import { assertConsortiumOwner } from "@/lib/consortium/consortium-service";
import {
  assertEmailNotAlreadySchoolOwner,
  inviteSchoolOwner,
} from "@/lib/onboarding/invite-school-owner";

export interface AssignConsortiumSchoolOwnerInput {
  consortiumId: string;
  schoolId: string;
  subjectId?: string;
  email?: string;
  inviteBaseUrl?: string;
  requestId: string;
  actorSubjectId: string;
}

export interface AssignConsortiumSchoolOwnerResult {
  schoolId: string;
  ownerSubjectId?: string;
  pendingOwnerStaffId?: string;
  ownerStatus: "assigned" | "pending_invite";
}

export async function assignConsortiumSchoolOwner(
  application: ApiSchoolApplication,
  input: AssignConsortiumSchoolOwnerInput,
): Promise<AssignConsortiumSchoolOwnerResult> {
  await assertConsortiumOwner(
    application.repositories,
    input.consortiumId,
    input.actorSubjectId,
  );

  const school = await application.repositories.schools.findById(input.schoolId);
  if (!school || school.consortiumId !== input.consortiumId) {
    throw new BusinessRuleViolationError(
      "SCHOOL_NOT_IN_CONSORTIUM",
      "School is not a member of this school group",
    );
  }

  const subjectId = input.subjectId?.trim();
  const email = input.email?.trim().toLowerCase();
  if ((subjectId && email) || (!subjectId && !email)) {
    throw new BusinessRuleViolationError(
      "ASSIGN_OWNER_INVALID_PAYLOAD",
      "Provide exactly one of subjectId or email",
    );
  }

  const callerStaff = await application.repositories.staffMembers.findOne({
    subjectId: input.actorSubjectId,
    schoolId: input.schoolId,
  });
  if (!callerStaff) {
    throw new BusinessRuleViolationError(
      "CONSORTIUM_STAFF_REQUIRED",
      "You must be a staff member of the school to assign its owner",
    );
  }

  const elevatedActor = createBootstrapStaffActorMetadata({
    schoolId: input.schoolId,
    requestId: input.requestId,
    staffMemberId: callerStaff.id,
    subjectId: input.actorSubjectId,
  });
  const service = application.forActor(elevatedActor);

  if (subjectId) {
    const staff = await application.repositories.staffMembers.findOne({
      subjectId,
      schoolId: input.schoolId,
    });
    if (!staff?.isActive) {
      throw new BusinessRuleViolationError(
        "OWNER_STAFF_NOT_FOUND",
        "No active linked staff member found for this subject in the school",
      );
    }

    const ownedSchool = await application.repositories.schools.findOne({ ownerSubjectId: subjectId });
    if (ownedSchool && ownedSchool.id !== input.schoolId) {
      throw new BusinessRuleViolationError(
        "OWNER_SUBJECT_ALREADY_ASSIGNED",
        "This account already owns another school",
      );
    }

    const updated = await service.setupWorkflow.updateSchoolConfiguration({
      schoolId: input.schoolId,
      ownerSubjectId: subjectId,
      pendingOwnerStaffId: null,
    });

    return {
      schoolId: updated.id,
      ownerSubjectId: updated.ownerSubjectId,
      ownerStatus: "assigned",
    };
  }

  if (!email) {
    throw new BusinessRuleViolationError(
      "ASSIGN_OWNER_INVALID_PAYLOAD",
      "Provide exactly one of subjectId or email",
    );
  }

  await assertEmailNotAlreadySchoolOwner(application, email, input.schoolId);

  const existingStaff = (await application.repositories.staffMembers.list({ schoolId: input.schoolId }))
    .find(member => member.email?.trim().toLowerCase() === email);

  if (existingStaff?.subjectId) {
    const ownedSchool = await application.repositories.schools.findOne({
      ownerSubjectId: existingStaff.subjectId,
    });
    if (ownedSchool && ownedSchool.id !== input.schoolId) {
      throw new BusinessRuleViolationError(
        "OWNER_SUBJECT_ALREADY_ASSIGNED",
        "This account already owns another school",
      );
    }

    const updated = await service.setupWorkflow.updateSchoolConfiguration({
      schoolId: input.schoolId,
      ownerSubjectId: existingStaff.subjectId,
      pendingOwnerStaffId: null,
    });

    return {
      schoolId: updated.id,
      ownerSubjectId: updated.ownerSubjectId,
      ownerStatus: "assigned",
    };
  }

  if (!input.inviteBaseUrl) {
    throw new BusinessRuleViolationError(
      "INVITE_BASE_URL_MISSING",
      "Invitation links are not configured for this environment",
    );
  }

  const inviteResult = await inviteSchoolOwner(application, elevatedActor, {
    email,
    inviteBaseUrl: input.inviteBaseUrl,
  });

  const refreshed = await application.repositories.schools.findById(input.schoolId);
  return {
    schoolId: input.schoolId,
    pendingOwnerStaffId: refreshed?.pendingOwnerStaffId ?? inviteResult.staffId,
    ownerStatus: "pending_invite",
  };
}
