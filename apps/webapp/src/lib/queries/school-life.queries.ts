import { loadCalendarEvents, loadIncidents } from '$lib/api/school-life-data';
import { loadPeopleData } from '$lib/api/people-data';
import { academicContext } from '$lib/academic/context.svelte';
import { queryClient } from '$lib/queries/client';
import { resolvePageLoad } from '$lib/queries/page-status';

export function querySchoolCalendarPage() {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({ events: [], classes: academicContext.classes }),
		load: async () => ({
			events: await loadCalendarEvents(queryClient()),
			classes: academicContext.classes,
		}),
		hasItems: data => data.events.length > 0,
	});
}

export function querySchoolEventsPage() {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({ incidents: [], students: [], classes: academicContext.classes }),
		load: async () => {
			const [incidents, { students }] = await Promise.all([
				loadIncidents(queryClient()),
				loadPeopleData(queryClient()),
			]);
			return { incidents, students, classes: academicContext.classes };
		},
		hasItems: data => data.incidents.length > 0,
	});
}
