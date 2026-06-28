import type { OnboardingDraft, OnboardingStep } from '$lib/onboarding/types';
import { ONBOARDING_DRAFT_VERSION } from '$lib/onboarding/types';

const STORAGE_PREFIX = 'edaya:onboarding:draft';

export function draftStorageKey(authUserId: string): string {
	return `${STORAGE_PREFIX}:${authUserId}`;
}

function defaultTimezone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';
	}
	catch {
		return 'Europe/Paris';
	}
}

export function createEmptyDraft(): OnboardingDraft {
	return {
		version: ONBOARDING_DRAFT_VERSION,
		updatedAt: new Date().toISOString(),
		maxReachedStep: 1,
		school: {
			name: '',
			city: '',
			country: 'France',
			timezone: defaultTimezone(),
			academicYearLabel: '',
			academicYearStart: '',
			academicYearEnd: '',
			periodLabel: '',
			periodType: 'trimester',
			periodStart: '',
			periodEnd: '',
		},
		structure: {
			models: [],
			levels: [],
		},
		staffInvites: [],
	};
}

function isOnboardingStep(value: unknown): value is OnboardingStep {
	return value === 1 || value === 2 || value === 3 || value === 4;
}

function normalizeDraft(raw: unknown): OnboardingDraft | null {
	if (!raw || typeof raw !== 'object') {
		return null;
	}

	const candidate = raw as Partial<OnboardingDraft>;
	if (candidate.version !== ONBOARDING_DRAFT_VERSION) {
		return null;
	}

	const empty = createEmptyDraft();
	const maxReachedStep = isOnboardingStep(candidate.maxReachedStep)
		? candidate.maxReachedStep
		: empty.maxReachedStep;

	return {
		version: ONBOARDING_DRAFT_VERSION,
		updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : empty.updatedAt,
		maxReachedStep,
		school: {
			...empty.school,
			...(candidate.school ?? {}),
		},
		structure: {
			models: Array.isArray(candidate.structure?.models)
				? candidate.structure.models.filter((entry): entry is 'college' | 'lycee' => entry === 'college' || entry === 'lycee')
				: empty.structure.models,
			levels: Array.isArray(candidate.structure?.levels)
				? candidate.structure.levels.map(level => ({
						gradeLevelId: typeof level.gradeLevelId === 'string' ? level.gradeLevelId : '',
						classCount: typeof level.classCount === 'number' ? level.classCount : 1,
						capacity: typeof level.capacity === 'number' ? level.capacity : 30,
					}))
				: empty.structure.levels,
		},
		staffInvites: Array.isArray(candidate.staffInvites)
			? candidate.staffInvites.map(invite => ({
					email: typeof invite.email === 'string' ? invite.email : '',
					role: typeof invite.role === 'string' ? invite.role : '',
				}))
			: empty.staffInvites,
	};
}

export function loadDraft(authUserId: string): OnboardingDraft | null {
	if (typeof sessionStorage === 'undefined') {
		return null;
	}

	try {
		const raw = sessionStorage.getItem(draftStorageKey(authUserId));
		if (!raw) {
			return null;
		}
		return normalizeDraft(JSON.parse(raw));
	}
	catch {
		return null;
	}
}

export function saveDraft(authUserId: string, draft: OnboardingDraft): void {
	if (typeof sessionStorage === 'undefined') {
		return;
	}

	const payload: OnboardingDraft = {
		...draft,
		updatedAt: new Date().toISOString(),
	};
	sessionStorage.setItem(draftStorageKey(authUserId), JSON.stringify(payload));
}

export function clearDraft(authUserId: string): void {
	if (typeof sessionStorage === 'undefined') {
		return;
	}
	sessionStorage.removeItem(draftStorageKey(authUserId));
}
