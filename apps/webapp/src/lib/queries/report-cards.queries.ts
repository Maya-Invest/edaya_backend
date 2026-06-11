import type {
	GradeScale,
	ReportCardDefinition,
	ReportCardResult,
} from '$lib/types/report-cards';
import { academicContext } from '$lib/academic/context.svelte';
import { loadReportCardsData } from '$lib/api/report-cards-data';
import { getBrowserSchoolClient } from '$lib/api/school-client';
import { resolvePageLoad } from '$lib/queries/page-status';

export async function getReportCardsLayoutData(): Promise<{
	gradeScales: GradeScale[];
	reportCardDefinitions: ReportCardDefinition[];
	reportCardResults: ReportCardResult[];
}> {
	const live = await loadReportCardsData(getBrowserSchoolClient());

	return {
		gradeScales: live.gradeScales,
		reportCardDefinitions: live.definitions,
		reportCardResults: live.results,
	};
}

export function queryClassReportCardsPage(classId: string) {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({ classId }),
		load: async () => ({ classId }),
		hasItems: () => academicContext.classes.some(entry => entry.id === classId),
	});
}
