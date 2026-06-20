import type { Crud } from '$lib/api/access-roles-data';
import type { components } from '$lib/api/schema';
import type { StaffRole } from '$lib/types/school';
import {
	buildPermissionsFromCrudMatrix,
	STAFF_ROLE_TO_ACCESS_ROLE_ID,
} from '$lib/api/access-roles-data';
import { runMutation } from '$lib/api/mutations/run-mutation';
import { getBrowserSchoolClient } from '$lib/api/school-client';

type ApiAccessRole = components['schemas']['AccessRole'];

export async function updateRolePermissionMutation(input: {
	role: StaffRole;
	matrix: Record<string, Record<Crud, boolean>>;
	successMessage?: string;
}): Promise<boolean> {
	const client = getBrowserSchoolClient();
	const accessRoleId = STAFF_ROLE_TO_ACCESS_ROLE_ID[input.role];
	const permissions = buildPermissionsFromCrudMatrix(input.matrix);

	const result = await runMutation(async () => {
		const role = await client.entities.accessRoles.get(accessRoleId);
		return client.entities.accessRoles.save({
			...role,
			permissions: permissions as ApiAccessRole['permissions'],
		});
	}, { successMessage: input.successMessage });

	return result !== null;
}
