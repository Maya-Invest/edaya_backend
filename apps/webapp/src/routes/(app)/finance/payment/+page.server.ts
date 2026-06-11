import { loadPaymentsPage } from '$lib/data/loaders.server';

export async function load({ parent, url }) {
	const { session } = await parent();
	return loadPaymentsPage({ url, hasSession: Boolean(session) });
}
