import { loadClassTeachingPage } from '$lib/data/loaders';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url, params }) => loadClassTeachingPage({ url, params });
