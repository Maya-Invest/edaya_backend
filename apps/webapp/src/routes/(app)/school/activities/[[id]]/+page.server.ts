import { loadSchoolActivitiesPage } from '$lib/data/loaders.server';

export async function load({ url, parent }) {
	const { session } = await parent();
	return loadSchoolActivitiesPage({ url, hasSession: Boolean(session) });
}
