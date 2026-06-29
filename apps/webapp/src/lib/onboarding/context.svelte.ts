import type { OnboardingDraft, OnboardingStep } from '$lib/onboarding/types';
import { browser } from '$app/environment';
import { authSession } from '$lib/auth/session.svelte';
import {
	clearDraft,
	createEmptyDraft,
	loadDraft,
	saveDraft,
} from '$lib/onboarding/draft-storage';

class OnboardingContext {
	draft = $state<OnboardingDraft>(createEmptyDraft());
	initialized = $state(false);
	private authUserId = $state<string | null>(null);

	init(authUserId: string) {
		if (!browser) {
			return;
		}

		if (this.authUserId === authUserId && this.initialized) {
			return;
		}

		this.authUserId = authUserId;
		this.draft = loadDraft(authUserId) ?? createEmptyDraft();
		if (authSession.schoolId && !this.draft.schoolStepSubmitted) {
			this.draft.schoolStepSubmitted = true;
			this.draft.registeredSchoolId = authSession.schoolId;
			saveDraft(authUserId, this.draft);
		}
		this.initialized = true;
	}

	reset() {
		this.authUserId = null;
		this.draft = createEmptyDraft();
		this.initialized = false;
	}

	persist() {
		if (!browser || !this.authUserId) {
			return;
		}
		saveDraft(this.authUserId, this.draft);
	}

	markStepReached(step: OnboardingStep) {
		if (step > this.draft.maxReachedStep) {
			this.draft.maxReachedStep = step;
		}
		this.persist();
	}

	markSchoolStepSubmitted(schoolId: string) {
		this.draft.schoolStepSubmitted = true;
		this.draft.registeredSchoolId = schoolId;
		this.persist();
	}

	markWizardCompleted() {
		this.draft.wizardCompleted = true;
		this.persist();
	}

	clearStoredDraft() {
		if (!browser || !this.authUserId) {
			return;
		}
		clearDraft(this.authUserId);
		this.draft = createEmptyDraft();
	}
}

export const onboardingContext = new OnboardingContext();
