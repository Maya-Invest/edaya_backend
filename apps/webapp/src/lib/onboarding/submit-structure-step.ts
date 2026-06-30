import { bootstrapAppShell, resetAppShellBootstrap } from '$lib/auth/bootstrap-app';
import { browserFetch } from '$lib/api/browser-fetch';
import type { OnboardingStructureDraft } from '$lib/onboarding/types';
import { ApiError } from '@edaya/api-client';
import { get } from 'svelte/store';
import { t } from '$lib/i18n';
import { toast } from '$lib/toast.svelte';

interface ApplyStructureResponse {
	gradeLevelCount: number;
	classGroupCount: number;
	subjectCount: number;
	classSubjectCount: number;
}

function messageFromError(error: unknown): string {
	if (error instanceof ApiError) {
		if (error.body && typeof error.body === 'object') {
			const body = error.body as Record<string, unknown>;
			if (body.code === 'STRUCTURE_ALREADY_CONFIGURED') {
				return get(t)('onboarding.structureStep.alreadyConfigured');
			}
			if (typeof body.message === 'string') {
				return body.message;
			}
		}
	}
	return get(t)('onboarding.structureStep.failed');
}

export async function submitStructureOnboardingStep(
	structure: OnboardingStructureDraft,
	options: { alreadySubmitted: boolean },
): Promise<boolean> {
	if (options.alreadySubmitted) {
		return true;
	}

	try {
		await browserFetch<ApplyStructureResponse>('/core/onboarding/apply-structure-template', {
			method: 'POST',
			body: JSON.stringify({
				models: structure.models,
				levels: structure.levels.map(level => ({
					gradeLevelId: level.gradeLevelId,
					classCount: level.classCount,
					capacity: level.capacity,
				})),
			}),
		});

		resetAppShellBootstrap();
		await bootstrapAppShell();

		toast.success(get(t)('onboarding.structureStep.success'));
		return true;
	}
	catch (error) {
		if (error instanceof ApiError && error.status === 409) {
			const body = error.body as Record<string, unknown> | undefined;
			if (body?.code === 'STRUCTURE_ALREADY_CONFIGURED') {
				resetAppShellBootstrap();
				await bootstrapAppShell();
				toast.success(get(t)('onboarding.structureStep.alreadyConfigured'));
				return true;
			}
		}
		toast.error(messageFromError(error));
		return false;
	}
}
