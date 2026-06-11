import { loadAppShell, loadReportCardsForLayout, loadSchoolLifeForLayout, loadStudent360ForLayout, loadTeachingLogForLayout } from '$lib/data/loaders.server';

export async function load({ parent }) {
	const { session } = await parent();
	const hasSession = Boolean(session);

	return {
		...await loadAppShell(hasSession),
		...await loadSchoolLifeForLayout({ hasSession }),
		...await loadStudent360ForLayout({ hasSession }),
		...await loadReportCardsForLayout({ hasSession }),
		...await loadTeachingLogForLayout({ hasSession }),
		session,
	};
}
