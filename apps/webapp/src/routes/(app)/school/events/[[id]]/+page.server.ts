import { loadSchoolEventsPage } from '$lib/data/loaders.server';

export async function load({ parent, url }) {
	const { session } = await parent();
	return loadSchoolEventsPage({ url, hasSession: Boolean(session) });
}
