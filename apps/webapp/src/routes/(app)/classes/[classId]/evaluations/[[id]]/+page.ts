import type { PageLoad } from './$types';
import { loadClassEvaluationsPage } from '$lib/data/loaders';

export const load: PageLoad = ({ url, params }) => loadClassEvaluationsPage({ url, params });
