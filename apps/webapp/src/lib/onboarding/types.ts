export const ONBOARDING_DRAFT_VERSION = 1 as const;
export const ONBOARDING_STEP_COUNT = 4;

export type OnboardingStep = 1 | 2 | 3 | 4;

export interface OnboardingSchoolDraft {
	name: string;
	city: string;
	country: string;
	timezone: string;
	academicYearLabel: string;
	academicYearStart: string;
	academicYearEnd: string;
	periodLabel: string;
	periodType: 'trimester' | 'semester';
	periodStart: string;
	periodEnd: string;
}

export interface OnboardingStructureLevelDraft {
	gradeLevelId: string;
	classCount: number;
	capacity: number;
}

export interface OnboardingStructureDraft {
	models: Array<'college' | 'lycee'>;
	levels: OnboardingStructureLevelDraft[];
}

export interface OnboardingStaffInviteDraft {
	email: string;
	role: string;
}

export interface OnboardingDraft {
	version: typeof ONBOARDING_DRAFT_VERSION;
	updatedAt: string;
	maxReachedStep: OnboardingStep;
	school: OnboardingSchoolDraft;
	structure: OnboardingStructureDraft;
	staffInvites: OnboardingStaffInviteDraft[];
}
