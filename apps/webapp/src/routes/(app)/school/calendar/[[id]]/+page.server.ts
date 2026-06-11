import { loadSchoolCalendarPage } from '$lib/data/loaders.server';

export async function load({ parent, url }) {
	const { session } = await parent();
	return loadSchoolCalendarPage({ url, hasSession: Boolean(session) });
}
