import { loadPeopleData } from '$lib/api/people-data';
import { loadClassPlanning } from '$lib/api/planning-data';
import { detailDataContext } from '$lib/detail-data/context.svelte';
import { queryClient } from '$lib/queries/client';
import { resolvePageLoad } from '$lib/queries/page-status';
import { getClassSubjects } from '$lib/queries/subjects.queries';

export function queryClassTimetablePage(classId: string) {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({ classId }),
		load: async () => {
			const [planning, { students }, subjects] = await Promise.all([
				loadClassPlanning(queryClient(), classId),
				loadPeopleData(queryClient()),
				getClassSubjects(classId),
			]);
			detailDataContext.seedPlanning(planning, { classId });
			detailDataContext.seedStudents(
				students.filter(student => student.classId === classId),
				{ classId },
			);
			detailDataContext.seedSubjects(subjects, { classId });
			return { classId };
		},
		// Timetable always renders the weekly calendar — an empty week is still a valid view.
		hasItems: () => true,
	});
}
