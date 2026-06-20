import { loadClassEvaluations } from '$lib/api/assessments-data';
import { detailDataContext } from '$lib/detail-data/context.svelte';
import { queryClient } from '$lib/queries/client';
import { resolvePageLoad } from '$lib/queries/page-status';
import { getClassSubjects } from '$lib/queries/subjects.queries';

export function queryClassEvaluationsPage(classId: string) {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({ classId }),
		load: async () => {
			const [evaluations, subjects] = await Promise.all([
				loadClassEvaluations(queryClient(), classId),
				getClassSubjects(classId),
			]);
			detailDataContext.seedEvaluations(evaluations, { classId });
			detailDataContext.seedSubjects(subjects, { classId });
			return { classId };
		},
		hasItems: () => detailDataContext.evaluationsForClass(classId).length > 0,
	});
}
