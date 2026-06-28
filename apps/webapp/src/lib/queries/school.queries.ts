import type { SchoolRaw } from '$lib/api/school-data';
import { fetchCurrentSchoolProfile } from '$lib/api/school-data';
import { getBrowserSchoolClient } from '$lib/api/school-client';
import type { School } from '$lib/types/school';
import { resolvePageLoad } from '$lib/queries/page-status';

export interface SchoolSettingsPageData {
	school: School | null;
	raw: SchoolRaw | null;
}

export function querySchoolSettingsPage() {
	return (url: URL) => resolvePageLoad(url, {
		empty: (): SchoolSettingsPageData => ({ school: null, raw: null }),
		load: async (): Promise<SchoolSettingsPageData> => {
			const client = getBrowserSchoolClient();
			return fetchCurrentSchoolProfile(client);
		},
		hasItems: data => Boolean(data.school),
		errorMessage: 'Unable to load school settings.',
	});
}
