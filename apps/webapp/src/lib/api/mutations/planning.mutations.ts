import type { ScheduleDayOfWeek } from '$lib/components/school/scheduling/planning-calendar';
import type { PlanningEvent } from '$lib/types/school';
import { runMutation } from '$lib/api/mutations/run-mutation';
import { getBrowserSchoolClient } from '$lib/api/school-client';
import {
	sessionInstantsForSlot,

} from '$lib/components/school/scheduling/planning-calendar';
import { detailDataContext } from '$lib/detail-data/context.svelte';

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
