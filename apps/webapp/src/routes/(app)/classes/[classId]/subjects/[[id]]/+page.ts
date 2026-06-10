import { loadClassSubjectsPage } from '$lib/data/loaders';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url, params }) => loadClassSubjectsPage({ url, params });
