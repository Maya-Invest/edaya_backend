import { loadClassEvaluations } from '$lib/api/assessments-data';
import { queryClient } from '$lib/queries/client';
import { resolvePageLoad } from '$lib/queries/page-status';

export async function getClassEvaluations(classId: string) {
	return loadClassEvaluations(queryClient(), classId);
}

export function queryClassEvaluationsPage(classId: string) {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({ classId, evaluations: [] }),
		load: async () => ({
			classId,
			evaluations: await getClassEvaluations(classId),
		}),
		hasItems: data => data.evaluations.length > 0,
	});
}
