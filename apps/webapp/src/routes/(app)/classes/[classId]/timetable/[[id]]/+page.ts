import { loadClassTimetablePage } from '$lib/data/loaders';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url, params }) => loadClassTimetablePage({ url, params });
