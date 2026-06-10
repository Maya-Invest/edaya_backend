import { loadSchoolStudentsPage } from '$lib/data/loaders';

export async function load({ parent, url }) {
	const { session } = await parent();
	return loadSchoolStudentsPage({ url, hasSession: Boolean(session) });
}
