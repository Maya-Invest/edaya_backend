import type {
	GradeScale,
	ReportCardDefinition,
	ReportCardResult,
} from '$lib/types/report-cards';
import { loadPeopleData } from '$lib/api/people-data';
import { loadReportCardsData } from '$lib/api/report-cards-data';
import { getBrowserSchoolClient } from '$lib/api/school-client';
import { detailDataContext } from '$lib/detail-data/context.svelte';
import { queryClient } from '$lib/queries/client';
import { resolvePageLoad } from '$lib/queries/page-status';
import { reportCardsContext } from '$lib/report-cards/context.svelte';

export async function refreshReportCardsLayout(): Promise<void> {
	const data = await getReportCardsLayoutData();
	reportCardsContext.hydrateFromServer(data);
}

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
		load: async () => {
			if (!reportCardsContext.ready) {
				await refreshReportCardsLayout();
			}
			const { students } = await loadPeopleData(queryClient());
			detailDataContext.seedStudents(
				students.filter(student => student.classId === classId),
				{ classId },
			);
			return { classId };
		},
		hasItems: () => detailDataContext.studentsForClass(classId).length > 0,
	});
}
