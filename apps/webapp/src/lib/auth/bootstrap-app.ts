import { academicContext } from '$lib/academic/context.svelte';
import { configureBrowserSchoolClient } from '$lib/api/school-client';
import { detailDataContext } from '$lib/detail-data/context.svelte';
import { getDetailDataSnapshot } from '$lib/queries/detail-data.queries';
import { fetchTeachingLogEntries } from '$lib/api/teaching-log-data';
import { getReportCardsLayoutData } from '$lib/queries/report-cards.queries';
import { getAppShellData } from '$lib/queries/shell.queries';
import { reportCardsContext } from '$lib/report-cards/context.svelte';
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
}

async function runBootstrapAppShell() {
	configureBrowserSchoolClient({
		getYearId: () => academicContext.yearId,
	});

	const [shell, reportCards, teachingLogEntries] = await Promise.all([
		getAppShellData(),
		getReportCardsLayoutData(),
		fetchTeachingLogEntries(),
	]);

	academicContext.initFromShell(shell);

	const detailData = await getDetailDataSnapshot(shell.classes.map(entry => entry.id));
	detailDataContext.hydrate(detailData);
	reportCardsContext.hydrateFromServer(reportCards);
	teachingLogContext.hydrateFromServer(teachingLogEntries);
}
