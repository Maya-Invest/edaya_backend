import type { PageLoad } from './$types';
import { loadSchoolCalendarPage } from '$lib/data/loaders';

export const load: PageLoad = ({ url }) => loadSchoolCalendarPage({ url });
