import type { PageLoad } from './$types';
import { loadClassTeachingPage } from '$lib/data/loaders';

export const load: PageLoad = ({ url, params }) => loadClassTeachingPage({ url, params });
