import { loadClassStudentsPage } from '$lib/data/loaders.server';

export async function load({ parent, url, params }) {
	const { session } = await parent();
	return loadClassStudentsPage({
		url,
		params,
		hasSession: Boolean(session),
	});
}
