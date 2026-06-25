import { loadPeopleData } from '$lib/api/people-data';
import { loadClassPlanning } from '$lib/api/planning-data';
import { loadSessionDetail } from '$lib/api/session-detail-data';
import { detailDataContext } from '$lib/detail-data/context.svelte';
import { queryClient } from '$lib/queries/client';
import { resolvePageLoad } from '$lib/queries/page-status';
import { getClassSubjects } from '$lib/queries/subjects.queries';
import { sessionDetailContext } from '$lib/session-detail/context.svelte';
import type { Student } from '$lib/types/school';

export function sessionDetailIdFromUrl(url: URL): string | undefined {
	return url.pathname.match(/\/classes\/[^/]+\/timetable\/([^/]+)$/)?.[1];
}

async function seedSessionDrawerForUrl(url: URL, classId: string, students: Student[]) {
	const sessionId = sessionDetailIdFromUrl(url);
	if (!sessionId) {
		return;
	}

	const detail = await loadSessionDetail(queryClient(), sessionId, students);
	if (detail) {
		sessionDetailContext.hydrate(sessionId, detail);
	}
}

export function queryClassTimetablePage(classId: string) {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({ classId }),
		load: async () => {
			const [planning, { students }, subjects] = await Promise.all([
				loadClassPlanning(queryClient(), classId),
				loadPeopleData(queryClient()),
				getClassSubjects(classId),
			]);
			const classStudents = students.filter(student => student.classId === classId);
			detailDataContext.seedPlanning(planning, { classId });
			detailDataContext.seedStudents(classStudents, { classId });
			detailDataContext.seedSubjects(subjects, { classId });
			await seedSessionDrawerForUrl(url, classId, classStudents);
			return { classId };
		},
		hasItems: () => true,
	});
}
