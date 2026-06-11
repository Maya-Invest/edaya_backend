import type { PageLoad } from './$types';
import { loadSchoolEventsPage } from '$lib/data/loaders';

export const load: PageLoad = ({ url }) => loadSchoolEventsPage({ url });
