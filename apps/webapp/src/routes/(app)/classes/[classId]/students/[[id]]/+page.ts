import { loadClassStudentsPage } from '$lib/data/loaders';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url, params }) => loadClassStudentsPage({ url, params });
