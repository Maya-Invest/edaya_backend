import type { components } from '$lib/api/schema';
import type { getBrowserSchoolClient } from '$lib/api/school-client';
import { academicContext } from '$lib/academic/context.svelte';
import { authSession } from '$lib/auth/session.svelte';

type SchoolClient = ReturnType<typeof getBrowserSchoolClient>;
export type SchoolOverviewResponse = components['schemas']['SchoolOverviewResponse'];

export async function fetchSchoolOverview(client: SchoolClient): Promise<SchoolOverviewResponse> {
	const schoolId = authSession.schoolId;
	if (!schoolId) {
		throw new Error('Missing school context for dashboard overview');
	}

	return client.queries.getSchoolOverview({
		schoolId,
		academicYearId: academicContext.yearId,
		academicPeriodId: academicContext.periodId,
	});
}
