import { loadClassEvaluationsPage } from '$lib/data/loaders';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url, params }) => loadClassEvaluationsPage({ url, params });
