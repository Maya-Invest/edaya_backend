import { loadSchoolGuardiansPage } from '$lib/data/loaders.server';

export async function load({ parent, url }) {
	const { session } = await parent();
	return loadSchoolGuardiansPage({ url, hasSession: Boolean(session) });
}
