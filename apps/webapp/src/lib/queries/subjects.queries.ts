import { fetchClassSubjectsSources, loadClassSubjects, mapAllClassSubjects } from '$lib/api/subjects-data';
import { academicContext } from '$lib/academic/context.svelte';
import { detailDataContext } from '$lib/detail-data/context.svelte';
import { queryClient } from '$lib/queries/client';
import { resolvePageLoad } from '$lib/queries/page-status';

export async function getClassSubjects(classId: string) {
	return loadClassSubjects(queryClient(), classId);
}

export async function getAllSubjects() {
	if (detailDataContext.ready) {
		return detailDataContext.subjects;
	}
	const sources = await fetchClassSubjectsSources(queryClient());
	return mapAllClassSubjects(sources);
}

export function queryClassSubjectsPage(classId: string) {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({ classId, subjects: [] }),
		load: async () => ({
			classId,
			subjects: await getClassSubjects(classId),
		}),
		hasItems: data => data.subjects.length > 0,
	});
}

export function queryClassTeachingPage(classId: string) {
	return queryClassSubjectsPage(classId);
}

export function queryConfigSubjectsPage() {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({ subjects: [], classes: academicContext.classes }),
		load: async () => ({
			subjects: await getAllSubjects(),
			classes: academicContext.classes,
		}),
		hasItems: data => data.subjects.length > 0,
	});
}
