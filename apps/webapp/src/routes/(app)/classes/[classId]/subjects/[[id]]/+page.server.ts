import { loadClassSubjectsPage } from '$lib/data/loaders';

export async function load({ parent, url, params }) {
	const { session } = await parent();
	return loadClassSubjectsPage({
		url,
		params,
		hasSession: Boolean(session),
	});
}
