import { loadSchoolStaffPage } from '$lib/data/loaders.server';

export async function load({ parent, url }) {
	const { session } = await parent();
	return loadSchoolStaffPage({ url, hasSession: Boolean(session) });
}
