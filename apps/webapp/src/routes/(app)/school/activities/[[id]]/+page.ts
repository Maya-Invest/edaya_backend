import type { PageLoad } from './$types';
import { loadSchoolActivitiesPage } from '$lib/data/loaders';

export const load: PageLoad = ({ url }) => loadSchoolActivitiesPage({ url });
