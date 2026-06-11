import { loadRolesPage } from '$lib/data/loaders.server';

export async function load({ url, parent }) {
	const { session } = await parent();
	return loadRolesPage({ url, hasSession: Boolean(session) });
}
