import type { ScheduleDayOfWeek } from '$lib/components/school/scheduling/planning-calendar';
import type { PlanningEvent } from '$lib/types/school';
import { runMutation } from '$lib/api/mutations/run-mutation';
import { getBrowserSchoolClient } from '$lib/api/school-client';
import { buildSessionSavePayload } from '$lib/api/session-save-payload';
import {
	sessionInstantsForSlot,
} from '$lib/components/school/scheduling/planning-calendar';
import { detailDataContext } from '$lib/detail-data/context.svelte';
import { t } from '$lib/i18n';
import { toast } from '$lib/toast.svelte';
import { get } from 'svelte/store';

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
	let existing;
	try {
		existing = await client.entities.sessions.get(input.sessionId);
	}
	catch {
		toast.error(get(t)('dataState.errorDescription'));
		return false;
	}

	const result = await runMutation(() => client.entities.sessions.save(
		buildSessionSavePayload(existing, {
			title: input.title,
			classSubjectId: input.classSubjectId,
			startsAt: sessionIso(input.day, input.start),
			endsAt: sessionIso(input.day, input.end),
		}),
	), { successMessage: input.successMessage });
	return result !== null;
}

export async function reschedulePlanningSlotMutation(input: {
	sessionId: string;
	scheduleId?: string;
	day: PlanningEvent['day'];
	dayOfWeek: ScheduleDayOfWeek;
	startTime: string;
	endTime: string;
	successMessage?: string;
	errorMessage?: string;
}): Promise<boolean> {
	const client = getBrowserSchoolClient();
	const previous = detailDataContext.planning.find(event => event.id === input.sessionId);
	const patch = {
		day: input.day,
		start: input.startTime,
		end: input.endTime,
	};

	const result = await runMutation(async () => {
		const session = await client.entities.sessions.get(input.sessionId);
		const referenceStartsAt = String(session.startsAt);
		const { startsAt, endsAt } = sessionInstantsForSlot(referenceStartsAt, {
			day: input.day,
			startTime: input.startTime,
			endTime: input.endTime,
		});

		if (input.scheduleId) {
			const schedule = await client.entities.schedules.get(input.scheduleId);
			await client.entities.schedules.save({
				...schedule,
				isRecurring: true,
				dayOfWeek: input.dayOfWeek,
				startTime: input.startTime,
				endTime: input.endTime,
			});
		}

		await client.entities.sessions.save({
			...session,
			startsAt: startsAt.toISOString(),
			endsAt: endsAt.toISOString(),
		});
	}, {
		apply: () => detailDataContext.patchPlanningEvent(input.sessionId, patch),
		rollback: () => {
			if (previous) {
				detailDataContext.patchPlanningEvent(input.sessionId, {
					day: previous.day,
					start: previous.start,
					end: previous.end,
				});
			}
		},
		successMessage: input.successMessage,
		errorMessage: input.errorMessage,
	});

	return result !== null;
}
