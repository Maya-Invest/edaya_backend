import { fetchDeadlines } from '$lib/api/homework-data';
import { detailDataContext } from '$lib/detail-data/context.svelte';
import { resolvePageLoad } from '$lib/queries/page-status';
import { getClassSubjects } from '$lib/queries/subjects.queries';

export { fetchActivities } from '$lib/api/activities-data';
export { fetchDeadlines } from '$lib/api/homework-data';
export { fetchTeachingLogEntries } from '$lib/api/teaching-log-data';
export { querySchoolActivitiesPage } from '$lib/queries/school-life.queries';

export function queryClassHomeworkPage(classId: string) {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({ classId }),
		load: async () => {
			const [deadlines, subjects] = await Promise.all([
				fetchDeadlines(classId),
				getClassSubjects(classId),
			]);
			detailDataContext.seedDeadlines(deadlines, { classId });
			detailDataContext.seedSubjects(subjects, { classId });
			return { classId };
		},
		hasItems: () => detailDataContext.deadlinesForClass(classId).length > 0,
	});
}
