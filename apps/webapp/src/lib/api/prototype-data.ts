import type { Activity } from '$lib/types/school';
import { browserFetch } from '$lib/api/browser-fetch';

interface PrototypeActivity {
	id: string;
	name: string;
	category: Activity['category'];
	coach: string;
	schedule: string;
	participants: number;
	capacity: number;
	description: string;
	startDate: string;
	endDate: string;
	enrollments: Activity['enrollments'];
}

export function mapActivities(raw: PrototypeActivity[]): Activity[] {
	return raw.map(activity => ({ ...activity }));
}

export async function fetchActivities(): Promise<Activity[]> {
	const raw = await browserFetch<PrototypeActivity[]>('/core/prototype/activities/list', {
		method: 'POST',
		body: JSON.stringify({}),
	});
	return mapActivities(raw ?? []);
}
