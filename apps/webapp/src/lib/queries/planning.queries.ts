import { academicContext } from '$lib/academic/context.svelte';
import { loadPeopleData } from '$lib/api/people-data';
import { loadClassPlanning } from '$lib/api/planning-data';
import { queryClient } from '$lib/queries/client';
import { resolvePageLoad } from '$lib/queries/page-status';

export async function getClassTimetable(classId: string) {
	return loadClassPlanning(queryClient(), classId);
}

export function queryClassTimetablePage(classId: string) {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({
			classId,
			planning: [],
			classes: academicContext.classes,
			students: [],
		}),
		load: async () => {
			const [planning, { students }] = await Promise.all([
				getClassTimetable(classId),
				loadPeopleData(queryClient()),
			]);
			return {
				classId,
				planning,
				classes: academicContext.classes,
				students,
			};
		},
		hasItems: data => data.planning.length > 0,
	});
}
