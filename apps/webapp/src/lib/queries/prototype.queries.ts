import { fetchActivities, fetchDeadlines } from '$lib/api/prototype-data';
import { resolvePageLoad } from '$lib/queries/page-status';

export { fetchActivities, fetchDeadlines, fetchTeachingLogEntries } from '$lib/api/prototype-data';

export function querySchoolActivitiesPage() {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({ activities: [] }),
		load: async () => ({ activities: await fetchActivities() }),
		hasItems: data => data.activities.length > 0,
	});
}

export function queryClassHomeworkPage(classId: string) {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({ classId, deadlines: [] }),
		load: async () => ({
			classId,
			deadlines: await fetchDeadlines(classId),
		}),
		hasItems: data => data.deadlines.length > 0,
	});
}
