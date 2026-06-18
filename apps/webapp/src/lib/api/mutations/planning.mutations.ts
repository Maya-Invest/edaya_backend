import type { PlanningEvent } from '$lib/types/school';
import { runMutation } from '$lib/api/mutations/run-mutation';
import { getBrowserSchoolClient } from '$lib/api/school-client';
import { toast } from '$lib/toast.svelte';
import { get } from 'svelte/store';
import { t } from '$lib/i18n';

const MONDAY_REF = new Date('2026-01-05T00:00:00.000Z');
const DAY_INDEX: Record<PlanningEvent['day'], number> = {
	Mon: 0,
	Tue: 1,
	Wed: 2,
	Thu: 3,
	Fri: 4,
};

function sessionIso(day: PlanningEvent['day'], time: string): string {
	const [hours, minutes] = time.split(':').map(Number);
	const date = new Date(MONDAY_REF);
	date.setUTCDate(MONDAY_REF.getUTCDate() + DAY_INDEX[day]);
	date.setUTCHours(hours, minutes, 0, 0);
	return date.toISOString();
}

export async function createSessionMutation(input: {
	classGroupId: string;
	title: string;
	classSubjectId?: string;
	day: PlanningEvent['day'];
	start: string;
	end: string;
	successMessage?: string;
}): Promise<string | null> {
	const client = getBrowserSchoolClient();
	const id = `sess-${Date.now().toString(36)}`;
	const result = await runMutation(() => client.commands.createSession({
		id,
		classGroupId: input.classGroupId,
		title: input.title.trim(),
		kind: 'course',
		startsAt: sessionIso(input.day, input.start),
		endsAt: sessionIso(input.day, input.end),
		classSubjectId: input.classSubjectId ?? null,
		createdAt: new Date().toISOString(),
	}), { successMessage: input.successMessage });
	return result ? id : null;
}

export async function updateSessionMutation(input: {
	sessionId: string;
	title: string;
	classSubjectId?: string | null;
	day: PlanningEvent['day'];
	start: string;
	end: string;
	successMessage?: string;
}): Promise<boolean> {
	const client = getBrowserSchoolClient();
	const existing = await client.entities.sessions.one({ id: input.sessionId });
	if (!existing) {
		toast.error(get(t)('dataState.errorDescription'));
		return false;
	}

	const result = await runMutation(() => client.entities.sessions.save({
		...existing,
		title: input.title.trim(),
		classSubjectId: input.classSubjectId ?? null,
		startsAt: sessionIso(input.day, input.start),
		endsAt: sessionIso(input.day, input.end),
	}), { successMessage: input.successMessage });
	return result !== null;
}
