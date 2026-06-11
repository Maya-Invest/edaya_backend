import type { PageLoad } from './$types';
import { loadClassTimetablePage } from '$lib/data/loaders';

export const load: PageLoad = ({ url, params }) => loadClassTimetablePage({ url, params });
