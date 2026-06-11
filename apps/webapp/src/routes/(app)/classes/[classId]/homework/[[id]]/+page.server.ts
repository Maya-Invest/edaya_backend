import { loadClassHomeworkPage } from '$lib/data/loaders.server';

export async function load({ parent, url, params }) {
	const { session } = await parent();
	return loadClassHomeworkPage({ url, params, hasSession: Boolean(session) });
}
