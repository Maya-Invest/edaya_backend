import type { PageLoad } from './$types';
import { loadPaymentsPage } from '$lib/data/loaders';

export const load: PageLoad = ({ url }) => loadPaymentsPage({ url });
