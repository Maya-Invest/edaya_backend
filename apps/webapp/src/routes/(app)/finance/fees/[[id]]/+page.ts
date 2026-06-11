import type { PageLoad } from './$types';
import { loadFinancePage } from '$lib/data/loaders';

export const load: PageLoad = ({ url }) => loadFinancePage({ url });
