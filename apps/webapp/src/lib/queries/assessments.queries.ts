import { academicContext } from '$lib/academic/context.svelte';
import { loadClassEvaluations } from '$lib/api/assessments-data';
import { detailDataContext } from '$lib/detail-data/context.svelte';
import { queryClient } from '$lib/queries/client';
import { listPageHasItems, resolvePageLoad } from '$lib/queries/page-status';
import { getClassSubjects } from '$lib/queries/subjects.queries';

export function queryClassEvaluationsPage(classId: string) {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({ classId }),
		load: async () => {
			const [evaluations, subjects] = await Promise.all([
				loadClassEvaluations(queryClient(), classId, academicContext.periodId),
				getClassSubjects(classId),
			]);
			detailDataContext.seedEvaluations(evaluations, { classId });
			detailDataContext.seedSubjects(subjects, { classId });
			return { classId };
		},
		hasItems: listPageHasItems,
	});
}
