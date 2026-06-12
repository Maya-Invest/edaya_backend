import { fetchDeadlines } from '$lib/api/homework-data';
import { fetchActivities } from '$lib/api/prototype-data';
import { resolvePageLoad } from '$lib/queries/page-status';

export { fetchDeadlines } from '$lib/api/homework-data';
export { fetchActivities } from '$lib/api/prototype-data';
export { fetchTeachingLogEntries } from '$lib/api/teaching-log-data';

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
