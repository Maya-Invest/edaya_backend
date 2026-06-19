import type { components } from '$lib/api/schema';
import type { SchoolYearEvent } from '$lib/types/school';
import { academicContext } from '$lib/academic/context.svelte';
import { authSession } from '$lib/auth/session.svelte';
import { runMutation } from '$lib/api/mutations/run-mutation';
import { getBrowserSchoolClient } from '$lib/api/school-client';
import { toast } from '$lib/toast.svelte';
import { get } from 'svelte/store';
import { t } from '$lib/i18n';

type ApiCalendarEvent = components['schemas']['CalendarEvent'];
type ApiKind = ApiCalendarEvent['kind'];
type ApiScopeKind = ApiCalendarEvent['scopeKind'];

const UI_TO_API_KIND: Record<SchoolYearEvent['type'], ApiKind> = {
	holiday: 'holiday',
	vacation: 'break',
	closure: 'other',
	ceremony: 'event',
};

function isNonSchoolDay(type: SchoolYearEvent['type']): boolean {
	return type !== 'ceremony';
}

function scopeFromUi(scope: SchoolYearEvent['scope']): { scopeKind: ApiScopeKind; scopeId?: string | null } {
	if (scope === 'all') {
		return { scopeKind: 'school', scopeId: null };
	}
	const [classGroupId] = scope;
	return { scopeKind: 'class_group', scopeId: classGroupId ?? null };
}

function calendarSavePayload(
	existing: ApiCalendarEvent,
	updates: {
		title: string;
		description: string;
		startDate: string;
		endDate: string;
		type: SchoolYearEvent['type'];
		scope: SchoolYearEvent['scope'];
	},
): ApiCalendarEvent {
	const { scopeKind, scopeId } = scopeFromUi(updates.scope);
	return {
		id: existing.id,
		schoolId: existing.schoolId,
		academicYearId: existing.academicYearId,
		title: updates.title,
		description: updates.description,
		startDate: updates.startDate,
		endDate: updates.endDate,
		kind: UI_TO_API_KIND[updates.type],
		isNonSchoolDay: isNonSchoolDay(updates.type),
		scopeKind,
		scopeId: scopeKind === 'school' ? null : scopeId,
		createdAt: existing.createdAt,
	};
}

export async function createCalendarEventMutation(input: {
	title: string;
	description: string;
	date: string;
	endDate?: string;
	type: SchoolYearEvent['type'];
	scope: SchoolYearEvent['scope'];
	successMessage?: string;
}): Promise<string | null> {
	const client = getBrowserSchoolClient();
	const schoolId = authSession.schoolId;
	const academicYearId = academicContext.yearId;
	if (!schoolId || !academicYearId) {
		toast.error(get(t)('calendar.noContext'));
		return null;
	}

	const endDate = input.endDate?.trim() || input.date;
	const description = input.description.trim() || input.title.trim();
	const baseId = `cal-${Date.now().toString(36)}`;
	const createdAt = new Date().toISOString();

	const result = await runMutation(async () => {
		if (input.scope === 'all') {
			await client.commands.createCalendarEvent({
				id: baseId,
				schoolId,
				academicYearId,
				title: input.title.trim(),
				description,
				startDate: input.date,
				endDate,
				kind: UI_TO_API_KIND[input.type],
				isNonSchoolDay: isNonSchoolDay(input.type),
				scopeKind: 'school',
				createdAt,
			});
			return baseId;
		}

		let firstId: string | null = null;
		for (const classGroupId of input.scope) {
			const id = `${baseId}-${classGroupId}`;
			await client.commands.createCalendarEvent({
				id,
				schoolId,
				academicYearId,
				title: input.title.trim(),
				description,
				startDate: input.date,
				endDate,
				kind: UI_TO_API_KIND[input.type],
				isNonSchoolDay: isNonSchoolDay(input.type),
				scopeKind: 'class_group',
				scopeId: classGroupId,
				createdAt,
			});
			firstId ??= id;
		}
		return firstId;
	}, { successMessage: input.successMessage });
	return result ?? null;
}

export async function updateCalendarEventMutation(input: {
	eventId: string;
	title: string;
	description: string;
	date: string;
	endDate?: string;
	type: SchoolYearEvent['type'];
	scope: SchoolYearEvent['scope'];
	successMessage?: string;
}): Promise<boolean> {
	const client = getBrowserSchoolClient();
	const endDate = input.endDate?.trim() || input.date;
	const description = input.description.trim() || input.title.trim();

	const result = await runMutation(async () => {
		const existing = await client.entities.calendarEvents.get(input.eventId);
		return client.entities.calendarEvents.save(calendarSavePayload(existing, {
			title: input.title.trim(),
			description,
			startDate: input.date,
			endDate,
			type: input.type,
			scope: input.scope,
		}));
	}, { successMessage: input.successMessage });
	return result !== null;
}
