import type { PageLoad } from './$types';
import { loadClassReportCardsPage } from '$lib/data/loaders';

export const load: PageLoad = ({ url, params }) => loadClassReportCardsPage({ url, params });
