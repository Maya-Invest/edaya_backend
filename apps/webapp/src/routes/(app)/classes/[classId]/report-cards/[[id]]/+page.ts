import { loadClassReportCardsPage } from '$lib/data/loaders';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url, params }) => loadClassReportCardsPage({ url, params });
