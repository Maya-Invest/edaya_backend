import { academicContext } from '$lib/academic/context.svelte';
import { fetchActivities } from '$lib/api/activities-data';
import { loadAbsences, loadCalendarEvents, loadIncidentRouteData } from '$lib/api/school-life-data';
import { detailDataContext } from '$lib/detail-data/context.svelte';
import { queryClient } from '$lib/queries/client';
import { resolvePageLoad } from '$lib/queries/page-status';

export function querySchoolActivitiesPage() {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({}),
		load: async () => {
			const activities = await fetchActivities(
				queryClient(),
				academicContext.schools[0]?.id ?? '',
			);
			detailDataContext.seedActivities(activities);
			return {};
		},
		hasItems: () => detailDataContext.activities.length > 0,
	});
}

export function querySchoolCalendarPage() {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({}),
		load: async () => {
			const [events, absences] = await Promise.all([
				loadCalendarEvents(queryClient(), academicContext.yearId),
				loadAbsences(queryClient(), academicContext.classes.map(entry => entry.id)),
			]);
			detailDataContext.seedSchoolYearEvents(events);
			detailDataContext.seedAbsences(absences);
			return {};
		},
		hasItems: () => detailDataContext.schoolYearEvents.length > 0,
	});
}

export function querySchoolEventsPage() {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({}),
		load: async () => {
			const { incidents, students } = await loadIncidentRouteData(queryClient(), {
				schoolId: academicContext.schools[0]?.id ?? '',
				academicYearId: academicContext.yearId,
			});
			detailDataContext.seedIncidents(incidents);
			detailDataContext.seedStudents(students);
			return {};
		},
		hasItems: () => detailDataContext.incidents.length > 0,
	});
}
