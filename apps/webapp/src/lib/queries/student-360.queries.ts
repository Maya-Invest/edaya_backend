import { loadStudent360Data } from '$lib/api/student-360-data';
import { queryClient } from '$lib/queries/client';

export async function getStudent360Data() {
	return loadStudent360Data(queryClient());
}
