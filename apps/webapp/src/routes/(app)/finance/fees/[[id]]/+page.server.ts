import { loadFinancePage } from '$lib/data/loaders.server';

export async function load({ parent, url }) {
	const { session } = await parent();
	return loadFinancePage({ url, hasSession: Boolean(session) });
}
