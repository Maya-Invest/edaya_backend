import type { DemoAccount } from '$lib/types/demo-account';
import { fetchAppShellData } from '$lib/api/shell-data';
import { getBrowserSchoolClient } from '$lib/api/school-client';

export async function getAppShellData() {
	return fetchAppShellData(getBrowserSchoolClient());
}
