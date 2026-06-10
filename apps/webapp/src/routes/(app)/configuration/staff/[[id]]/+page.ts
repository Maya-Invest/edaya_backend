import { loadSchoolStaffPage } from '$lib/data/loaders';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => loadSchoolStaffPage({ url });
