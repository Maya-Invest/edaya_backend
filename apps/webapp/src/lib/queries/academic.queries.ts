import { academicContext } from '$lib/academic/context.svelte';
import { resolvePageLoad } from '$lib/queries/page-status';
import { refreshReportCardsLayout } from '$lib/queries/report-cards.queries';
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
		empty: () => ({}),
		load: async () => {
			if (!reportCardsContext.ready) {
				await refreshReportCardsLayout();
			}
			return {};
		},
		hasItems: () => reportCardsContext.scales.length > 0,
	});
}

export function queryReportCardDefinitionsPage() {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({}),
		load: async () => {
			if (!reportCardsContext.ready) {
				await refreshReportCardsLayout();
			}
			return {};
		},
		hasItems: () => reportCardsContext.definitions.length > 0,
	});
}
