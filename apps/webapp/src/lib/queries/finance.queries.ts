import { loadFinanceData } from '$lib/api/finance-data';
import { loadPeopleData } from '$lib/api/people-data';
import { academicContext } from '$lib/academic/context.svelte';
import { queryClient } from '$lib/queries/client';
import { resolvePageLoad } from '$lib/queries/page-status';

export async function getFinanceData() {
	return loadFinanceData(queryClient());
}

export function queryFinancePage() {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({ fees: [], billing: [], students: [] }),
		load: async () => {
			const [{ fees, billing }, { students }] = await Promise.all([
				getFinanceData(),
				loadPeopleData(queryClient()),
			]);
			return { fees, billing, students };
		},
		hasItems: data => data.fees.length > 0 || data.billing.length > 0,
	});
}

export function queryPaymentsPage() {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({ billing: [], students: [], fees: [], classes: [] }),
		load: async () => {
			const [{ billing, fees }, { students }] = await Promise.all([
				getFinanceData(),
				loadPeopleData(queryClient()),
			]);
			return {
				billing,
				fees,
				students,
				classes: academicContext.classes,
			};
		},
		hasItems: data => data.billing.length > 0,
	});
}
