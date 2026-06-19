import type { SchoolOverviewResponse } from '$lib/api/dashboard-data';
import { fetchSchoolOverview } from '$lib/api/dashboard-data';
import { queryClient } from '$lib/queries/client';
import { resolvePageLoad } from '$lib/queries/page-status';

export interface DashboardPageData {
	overview: SchoolOverviewResponse | null;
}

export function queryDashboardPage() {
	return (url: URL) => resolvePageLoad(url, {
		empty: (): DashboardPageData => ({ overview: null }),
		load: async () => ({ overview: await fetchSchoolOverview(queryClient()) }),
		hasItems: data => data.overview !== null,
	});
}
