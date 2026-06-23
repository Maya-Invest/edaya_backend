import { academicContext } from '$lib/academic/context.svelte';
import { loadFinanceData } from '$lib/api/finance-data';
import { detailDataContext } from '$lib/detail-data/context.svelte';
import { queryClient } from '$lib/queries/client';
import { resolvePageLoad } from '$lib/queries/page-status';

async function seedFinancePageData() {
	const { fees, billing, students } = await loadFinanceData(queryClient(), {
		schoolId: academicContext.schools[0]?.id ?? '',
		academicYearId: academicContext.yearId,
	});
	detailDataContext.seedFees(fees);
	detailDataContext.seedBilling(billing);
	detailDataContext.seedStudents(students);
}

export function queryFinancePage() {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({}),
		load: async () => {
			await seedFinancePageData();
			return {};
		},
		hasItems: () => detailDataContext.fees.length > 0 || detailDataContext.billing.length > 0,
	});
}

export function queryPaymentsPage() {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({}),
		load: async () => {
			await seedFinancePageData();
			return {};
		},
		hasItems: () => detailDataContext.billing.length > 0,
	});
}
