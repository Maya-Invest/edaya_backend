import type { OnboardingDraft, OnboardingStep } from '$lib/onboarding/types';
import { browser } from '$app/environment';
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

	clearStoredDraft() {
		if (!browser || !this.authUserId) {
			return;
		}
		clearDraft(this.authUserId);
		this.draft = createEmptyDraft();
	}
}

export const onboardingContext = new OnboardingContext();
