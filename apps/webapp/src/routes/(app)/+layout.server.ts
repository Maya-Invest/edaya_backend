import { loadAppShell } from '$lib/data/loaders';

export async function load({ parent }) {
	const { session } = await parent();
	return {
		...await loadAppShell(Boolean(session)),
		session,
	};
}
