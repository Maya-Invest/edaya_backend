import type { Activity } from '$lib/types/school';
import { buildActivitySavePayload, DEFAULT_ACTIVITY_SCHEDULE } from '$lib/api/activity-save-payload';
import { runMutation } from '$lib/api/mutations/run-mutation';
import { getBrowserSchoolClient } from '$lib/api/school-client';
import { authSession } from '$lib/auth/session.svelte';
import { t } from '$lib/i18n';
import { toast } from '$lib/toast.svelte';
import { get } from 'svelte/store';

export async function createActivityMutation(input: {
	name: string;
	category: Activity['category'];
	coach: string;
	capacity: number;
	description: string;
	startDate: string;
	endDate: string;
	successMessage?: string;
}): Promise<string | null> {
	const client = getBrowserSchoolClient();
	const schoolId = authSession.schoolId;
	if (!schoolId) {
		toast.error(get(t)('dataState.errorDescription'));
		return null;
	}

	const activityId = `act-${Date.now().toString(36)}`;
	const result = await runMutation(() => client.entities.activities.save({
		id: activityId,
		schoolId,
		name: input.name.trim(),
		category: input.category,
		coach: input.coach.trim(),
		schedule: DEFAULT_ACTIVITY_SCHEDULE,
		participants: 0,
		capacity: input.capacity,
		description: input.description.trim(),
		startDate: input.startDate,
		endDate: input.endDate,
		createdAt: new Date().toISOString(),
	}), { successMessage: input.successMessage });

	return result ? activityId : null;
}

export async function updateActivityMutation(input: {
	activityId: string;
	name: string;
	category: Activity['category'];
	coach: string;
	capacity: number;
	description: string;
	startDate: string;
	endDate: string;
	successMessage?: string;
}): Promise<boolean> {
	const client = getBrowserSchoolClient();
	let existing;
	try {
		existing = await client.entities.activities.get(input.activityId);
	}
	catch {
		toast.error(get(t)('dataState.errorDescription'));
		return false;
	}

	const result = await runMutation(() => client.entities.activities.save(
		buildActivitySavePayload(existing, {
			name: input.name,
			category: input.category,
			coach: input.coach,
			capacity: input.capacity,
			description: input.description,
			startDate: input.startDate,
			endDate: input.endDate,
		}),
	), { successMessage: input.successMessage });
	return result !== null;
}
