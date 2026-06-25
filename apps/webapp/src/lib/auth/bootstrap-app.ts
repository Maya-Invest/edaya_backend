import { academicContext } from '$lib/academic/context.svelte';
import { configureBrowserSchoolClient } from '$lib/api/school-client';
import { detailDataContext } from '$lib/detail-data/context.svelte';
import { pageQueryStatus } from '$lib/queries/page-query-status.svelte';
import { getAppShellData } from '$lib/queries/shell.queries';
import { reportCardsContext } from '$lib/report-cards/context.svelte';
import { sessionDetailContext } from '$lib/session-detail/context.svelte';
import { teachingLogContext } from '$lib/teaching-log/context.svelte';

let bootstrapPromise: Promise<void> | null = null;

export function bootstrapAppShell(): Promise<void> {
	if (!bootstrapPromise) {
		bootstrapPromise = runBootstrapAppShell();
	}
	return bootstrapPromise;
}

export function resetAppShellBootstrap() {
	bootstrapPromise = null;
	academicContext.reset();
	detailDataContext.reset();
	reportCardsContext.reset();
	teachingLogContext.reset();
	sessionDetailContext.reset();
	pageQueryStatus.reset();
}

async function runBootstrapAppShell() {
	configureBrowserSchoolClient({
		getYearId: () => academicContext.yearId,
	});

	const shell = await getAppShellData();
	academicContext.initFromShell(shell);
}
