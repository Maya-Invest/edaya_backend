import { dev } from '$app/environment';
import { checkApiHealth } from '$lib/server/api-client';
import { error } from '@sveltejs/kit';

export async function GET() {
	if (!dev)
		error(404, 'Not found');

	return Response.json(await checkApiHealth());
}
