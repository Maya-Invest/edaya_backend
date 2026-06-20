import type { ReportCardDefinition } from '$lib/types/report-cards';
import { academicContext } from '$lib/academic/context.svelte';
import { resolvePageLoad } from '$lib/queries/page-status';
import { getReportCardsLayoutData } from '$lib/queries/report-cards.queries';
import { reportCardsContext } from '$lib/report-cards/context.svelte';

export function queryClassGroupsPage() {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({ classCount: 0 }),
		load: async () => ({ classCount: academicContext.classes.length }),
		hasItems: data => data.classCount > 0,
	});
}

export function queryAcademicAdminPage() {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({ yearCount: 0 }),
		load: async () => ({ yearCount: academicContext.years.length }),
		hasItems: data => data.yearCount > 0,
	});
}

export function queryGradeScalesPage() {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({ scaleCount: 0 }),
		load: async () => {
			if (reportCardsContext.ready) {
				return { scaleCount: reportCardsContext.scales.length };
			}
			const { gradeScales } = await getReportCardsLayoutData();
			return { scaleCount: gradeScales.length };
		},
		hasItems: data => data.scaleCount > 0,
	});
}

export function queryReportCardDefinitionsPage() {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({ definitions: [] as ReportCardDefinition[] }),
		load: async () => {
			if (reportCardsContext.ready) {
				return { definitions: reportCardsContext.definitions };
			}
			const { reportCardDefinitions } = await getReportCardsLayoutData();
			return { definitions: reportCardDefinitions };
		},
		hasItems: data => data.definitions.length > 0,
	});
}
