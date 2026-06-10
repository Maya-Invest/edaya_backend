import { checkApiHealth } from '$lib/server/api-client';

export async function load() {
	return {
		api: await checkApiHealth(),
	};
}
