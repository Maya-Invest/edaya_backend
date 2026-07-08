import { BusinessRuleViolationError, StaffMember } from "@edaya/core";
import type { ActorMetadata } from "@edaya/authorization";
import type { SchoolRepositories } from "@edaya/service";

export type OnboardingStepNumber = 1 | 2 | 3 | 4;

export interface OnboardingAccountStatus {
  wizardCompleted: boolean;
  maxReachedStep: OnboardingStepNumber;
  schoolStepSubmitted: boolean;
  structureStepSubmitted: boolean;
}

function clampStep(value: number): OnboardingStepNumber {
  if (value <= 1) {
    return 1;
  }
  if (value >= 4) {
    return 4;
  }
  return value as OnboardingStepNumber;
}

function requireStaffActor(actor: ActorMetadata): asserts actor is ActorMetadata & { kind: "staff"; staffMemberId: string; schoolId: string } {
  if (actor.kind !== "staff" || !actor.staffMemberId || !actor.schoolId) {
    throw new BusinessRuleViolationError(
      "ONBOARDING_STAFF_REQUIRED",
      "Onboarding status is only available for linked staff accounts",
    );
  }
}

export async function resolveOnboardingAccountStatus(
  repositories: SchoolRepositories,
  actor: ActorMetadata,
): Promise<OnboardingAccountStatus> {
  requireStaffActor(actor);

  const [staffMember, school, gradeLevels, academicYears] = await Promise.all([
    repositories.staffMembers.findById(actor.staffMemberId),
    repositories.schools.findById(actor.schoolId),
    repositories.gradeLevels.list({ schoolId: actor.schoolId }),
    repositories.academicYears.list({ schoolId: actor.schoolId }),
  ]);

  if (!staffMember || staffMember.schoolId !== actor.schoolId) {
    throw new BusinessRuleViolationError(
      "ONBOARDING_STAFF_NOT_FOUND",
      "Staff account not found for onboarding status",
    );
  }

  const isSchoolOwner = Boolean(
    school?.ownerSubjectId
    && staffMember.subjectId
    && school.ownerSubjectId === staffMember.subjectId,
  );

  if (!isSchoolOwner) {
    return {
      wizardCompleted: true,
      maxReachedStep: 4,
      schoolStepSubmitted: true,
      structureStepSubmitted: gradeLevels.length > 0,
    };
  }

  const structureStepSubmitted = gradeLevels.length > 0;
  const schoolStepSubmitted = academicYears.length > 0;
  const wizardCompleted = Boolean(staffMember.onboardingWizardCompletedAt)
    || (schoolStepSubmitted && structureStepSubmitted);

  let maxReachedStep = staffMember.onboardingMaxReachedStep ?? 1;
  if (schoolStepSubmitted) {
    maxReachedStep = Math.max(maxReachedStep, 2);
  }
  if (structureStepSubmitted) {
    maxReachedStep = Math.max(maxReachedStep, 3);
  }
  if (wizardCompleted) {
    maxReachedStep = 4;
  }

  return {
    wizardCompleted,
    maxReachedStep: clampStep(maxReachedStep),
    schoolStepSubmitted,
    structureStepSubmitted,
  };
}

export async function recordOnboardingAccountProgress(
  repositories: SchoolRepositories,
  actor: ActorMetadata,
  progress: {
    maxReachedStep?: OnboardingStepNumber;
    wizardCompleted?: boolean;
  },
): Promise<void> {
  requireStaffActor(actor);

  const staffMember = await repositories.staffMembers.findById(actor.staffMemberId);
  if (!staffMember || staffMember.schoolId !== actor.schoolId) {
    throw new BusinessRuleViolationError(
      "ONBOARDING_STAFF_NOT_FOUND",
      "Staff account not found for onboarding progress",
    );
  }

  const nextMaxReachedStep = progress.maxReachedStep === undefined
    ? staffMember.onboardingMaxReachedStep
    : Math.max(staffMember.onboardingMaxReachedStep ?? 1, progress.maxReachedStep);

  await repositories.staffMembers.save(new StaffMember({
    id: staffMember.id,
    schoolId: staffMember.schoolId,
    firstName: staffMember.firstName,
    lastName: staffMember.lastName,
    photoUrl: staffMember.photoUrl,
    email: staffMember.email,
    notificationEmail: staffMember.notificationEmail,
    notificationPhone: staffMember.notificationPhone,
    subjectId: staffMember.subjectId,
    accountKind: staffMember.accountKind,
    serviceId: staffMember.serviceId,
    createdBySubjectId: staffMember.createdBySubjectId,
    serviceElevated: staffMember.serviceElevated,
    isActive: staffMember.isActive,
    createdAt: staffMember.createdAt,
    onboardingMaxReachedStep: nextMaxReachedStep,
    onboardingWizardCompletedAt: progress.wizardCompleted
      ? (staffMember.onboardingWizardCompletedAt ?? new Date())
      : staffMember.onboardingWizardCompletedAt,
  }));
}

export async function completeOnboardingWizard(
  repositories: SchoolRepositories,
  actor: ActorMetadata,
): Promise<OnboardingAccountStatus> {
  await recordOnboardingAccountProgress(repositories, actor, {
    maxReachedStep: 4,
    wizardCompleted: true,
  });
  return resolveOnboardingAccountStatus(repositories, actor);
}
