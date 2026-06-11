import type { PageLoad } from './$types';
import { loadConfigSubjectsPage } from '$lib/data/loaders';

export const load: PageLoad = ({ url }) => loadConfigSubjectsPage({ url });
