import { loadClassTeachingPage } from '$lib/data/loaders.server';

export async function load({ parent, url, params }) {
	const { session } = await parent();
	return loadClassTeachingPage({ url, params, hasSession: Boolean(session) });
}
