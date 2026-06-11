import { loadClassTimetablePage } from '$lib/data/loaders.server';

export async function load({ parent, url, params }) {
	const { session } = await parent();
	return loadClassTimetablePage({ url, params, hasSession: Boolean(session) });
}
