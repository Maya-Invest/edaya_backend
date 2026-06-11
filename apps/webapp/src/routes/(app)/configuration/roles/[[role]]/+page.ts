import type { PageLoad } from './$types';
import { loadRolesPage } from '$lib/data/loaders';

export const load: PageLoad = ({ url }) => loadRolesPage({ url });
