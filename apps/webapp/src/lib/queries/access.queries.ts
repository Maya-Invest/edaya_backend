import { loadAccessRolesData } from '$lib/api/access-roles-data';
import { fetchStaffMembers } from '$lib/api/staff-data';
import { queryClient } from '$lib/queries/client';
import { resolvePageLoad } from '$lib/queries/page-status';

export async function getAccessRolesData() {
	return loadAccessRolesData(queryClient());
}

export function queryRolesPage() {
	return (url: URL) => resolvePageLoad(url, {
		empty: () => ({
			staff: [],
			accessRoles: [],
			roleCrudMatrix: {},
			roleEnabledPermissions: {},
		}),
		load: async () => {
			const [staff, accessRolesData] = await Promise.all([
				fetchStaffMembers(queryClient()),
				getAccessRolesData(),
			]);
			return { staff, ...accessRolesData };
		},
		hasItems: data => data.staff.length > 0,
	});
}
